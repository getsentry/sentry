import logging
import re
from typing import Any, List

import sentry_sdk
from django.db import IntegrityError, router, transaction
from django.utils.text import slugify
from drf_spectacular.utils import extend_schema, extend_schema_serializer, inline_serializer
from rest_framework import serializers, status
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.endpoints.organization_teams import CONFLICTING_SLUG_ERROR, TeamPostSerializer
from sentry.api.endpoints.team_details import TeamDetailsEndpoint, TeamSerializer
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import (
    OrganizationTeamSCIMSerializerResponse,
    TeamSCIMSerializer,
)
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_SUCCESS,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.scim_examples import SCIMExamples
from sentry.apidocs.parameters import GlobalParams, SCIMParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team, TeamStatus
from sentry.utils import json, metrics
from sentry.utils.cursors import SCIMCursor

from ...signals import team_created
from ...utils.snowflake import MaxSnowflakeRetryError
from .constants import (
    SCIM_400_INTEGRITY_ERROR,
    SCIM_400_INVALID_FILTER,
    SCIM_400_TOO_MANY_PATCH_OPS_ERROR,
    SCIM_400_UNSUPPORTED_ATTRIBUTE,
    SCIM_404_GROUP_RES,
    SCIM_404_USER_RES,
    TeamPatchOps,
)
from .utils import (
    OrganizationSCIMTeamPermission,
    SCIMApiError,
    SCIMEndpoint,
    SCIMFilterError,
    SCIMListBaseResponse,
    SCIMQueryParamSerializer,
    parse_filter_conditions,
)

delete_logger = logging.getLogger("sentry.deletions.api")


@extend_schema_serializer(dict)
class SCIMTeamPatchOperationSerializer(serializers.Serializer):
    op = serializers.CharField(required=True)
    value = serializers.JSONField(required=False)
    path = serializers.CharField(required=False)
    # TODO: define exact schema for value
    # TODO: actually use these in the patch request for validation

    def validate_op(self, value: str) -> str:
        value = value.lower()
        if value in [TeamPatchOps.REPLACE, TeamPatchOps.REMOVE, TeamPatchOps.ADD]:
            return value
        raise serializers.ValidationError(f'"{value}" is not a valid choice')


@extend_schema_serializer(exclude_fields="schemas")
class SCIMTeamPatchRequestSerializer(serializers.Serializer):
    # we don't actually use "schemas" for anything atm but its part of the spec
    schemas = serializers.ListField(child=serializers.CharField(), required=True)
    Operations = serializers.ListField(
        child=SCIMTeamPatchOperationSerializer(),
        required=True,
        source="operations",
        help_text="""The list of operations to perform. Valid operations are:
* Renaming a team:
```json
{
    "Operations": [{
        "op": "replace",
        "value": {
            "id": 23,
            "displayName": "newName"
        }
    }]
}
```
* Adding a member to a team:
```json
{
    "Operations": [{
        "op": "add",
        "path": "members",
        "value": [
            {
                "value": 23,
                "display": "testexample@example.com"
            }
        ]
    }]
}
```
* Removing a member from a team:
```json
{
    "Operations": [{
        "op": "remove",
        "path": "members[value eq \"23\"]"
    }]
}
```
* Replacing an entire member set of a team:
```json
{
    "Operations": [{
        "op": "replace",
        "path": "members",
        "value": [
            {
                "value": 23,
                "display": "testexample2@sentry.io"
            },
            {
                "value": 24,
                "display": "testexample3@sentry.io"
            }
        ]
    }]
}
```
""",
    )


def _team_expand(excluded_attributes):
    return None if "members" in excluded_attributes else ["members"]


class SCIMListTeamsResponse(SCIMListBaseResponse):
    Resources: List[OrganizationTeamSCIMSerializerResponse]


@extend_schema(tags=["SCIM"])
@region_silo_endpoint
class OrganizationSCIMTeamIndex(SCIMEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationSCIMTeamPermission,)

    @extend_schema(
        operation_id="List an Organization's Paginated Teams",
        parameters=[GlobalParams.ORG_SLUG, SCIMQueryParamSerializer],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "SCIMListResponseEnvelopeSCIMTeamIndexResponse", SCIMListTeamsResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SCIMExamples.LIST_ORG_PAGINATED_TEAMS,
    )
    def get(self, request: Request, organization: Organization, **kwds: Any) -> Response:
        """
        Returns a paginated list of teams bound to a organization with a SCIM Groups GET Request.

        Note that the members field will only contain up to 10,000 members.
        """
        query_params = self.get_query_parameters(request)

        queryset = Team.objects.filter(
            organization=organization, status=TeamStatus.ACTIVE
        ).order_by("slug")
        if query_params["filter"]:
            queryset = queryset.filter(slug__iexact=slugify(query_params["filter"]))

        def data_fn(offset, limit):
            return list(queryset[offset : offset + limit])

        def on_results(results):
            results = serialize(
                results,
                None,
                TeamSCIMSerializer(expand=_team_expand(query_params["excluded_attributes"])),
            )
            return self.list_api_format(results, queryset.count(), query_params["start_index"])

        return self.paginate(
            request=request,
            on_results=on_results,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            default_per_page=query_params["count"],
            cursor_cls=SCIMCursor,
        )

    @extend_schema(
        operation_id="Provision a New Team",
        parameters=[GlobalParams.ORG_SLUG],
        request=inline_serializer(
            name="SCIMTeamRequestBody",
            fields={
                "displayName": serializers.CharField(
                    help_text="The slug of the team that is shown in the UI.",
                    required=True,
                ),
            },
        ),
        responses={
            201: TeamSCIMSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SCIMExamples.PROVISION_NEW_TEAM,
    )
    def post(self, request: Request, organization: Organization, **kwds: Any) -> Response:
        """
        Create a new team bound to an organization via a SCIM Groups POST
        Request. The slug will have a normalization of uppercases/spaces to
        lowercases and dashes.

        Note that teams are always created with an empty member set.
        """
        # shim displayName from SCIM api in order to work with
        # our regular team index POST
        request.data.update(
            {
                "name": request.data["displayName"],
                "slug": slugify(request.data["displayName"]),
                "idp_provisioned": True,
            }
        )
        metrics.incr("sentry.scim.team.provision")
        serializer = TeamPostSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            try:
                with transaction.atomic(router.db_for_write(Team)):
                    team = Team.objects.create(
                        name=result.get("name") or result["slug"],
                        slug=result["slug"],
                        idp_provisioned=result.get("idp_provisioned", False),
                        organization_id=organization.id,
                    )

                team_created.send_robust(
                    organization_id=organization.id,
                    user_id=request.user.id,
                    team_id=team.id,
                    sender=None,
                )
            except (IntegrityError, MaxSnowflakeRetryError):
                return Response(
                    {
                        "non_field_errors": [CONFLICTING_SLUG_ERROR],
                        "detail": CONFLICTING_SLUG_ERROR,
                    },
                    status=409,
                )

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=team.id,
                event=audit_log.get_event_id("TEAM_ADD"),
                data=team.get_audit_log_data(),
            )
            return Response(
                serialize(team, request.user, TeamSCIMSerializer(expand=["members"])),
                status=201,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@extend_schema(tags=["SCIM"])
@region_silo_endpoint
class OrganizationSCIMTeamDetails(SCIMEndpoint, TeamDetailsEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
        "PATCH": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationSCIMTeamPermission,)

    def convert_args(self, request: Request, organization_slug: str, team_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug)
        try:
            kwargs["team"] = self._get_team(kwargs["organization"], team_id)
        except Team.DoesNotExist:
            raise ResourceDoesNotExist(detail=SCIM_404_GROUP_RES)
        return (args, kwargs)

    def _get_team(self, organization, team_id):
        team = (
            Team.objects.filter(organization=organization, id=team_id)
            .select_related("organization")
            .get()
        )
        if team.status != TeamStatus.ACTIVE:
            raise Team.DoesNotExist
        return team

    @extend_schema(
        operation_id="Query an Individual Team",
        parameters=[SCIMParams.TEAM_ID, GlobalParams.ORG_SLUG],
        request=None,
        responses={
            200: TeamSCIMSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=SCIMExamples.QUERY_INDIVIDUAL_TEAM,
    )
    def get(self, request: Request, organization, team) -> Response:
        """
        Query an individual team with a SCIM Group GET Request.
        - Note that the members field will only contain up to 10000 members.
        """
        query_params = self.get_query_parameters(request)

        context = serialize(
            team,
            serializer=TeamSCIMSerializer(expand=_team_expand(query_params["excluded_attributes"])),
        )
        return Response(context)

    def _add_members_operation(self, request: Request, operation, team):
        for member in operation["value"]:
            member = OrganizationMember.objects.get(
                organization=team.organization, id=member["value"]
            )
            if OrganizationMemberTeam.objects.filter(team=team, organizationmember=member).exists():
                # if a member already belongs to a team, do nothing
                continue

            with transaction.atomic(router.db_for_write(OrganizationMemberTeam)):
                omt = OrganizationMemberTeam.objects.create(team=team, organizationmember=member)
                self.create_audit_entry(
                    request=request,
                    organization=team.organization,
                    target_object=omt.id,
                    target_user_id=member.user_id,
                    event=audit_log.get_event_id("MEMBER_JOIN_TEAM"),
                    data=omt.get_audit_log_data(),
                )

    def _remove_members_operation(self, request: Request, member_id, team):
        member = OrganizationMember.objects.get(organization=team.organization, id=member_id)
        with transaction.atomic(router.db_for_write(OrganizationMemberTeam)):
            try:
                omt = OrganizationMemberTeam.objects.get(team=team, organizationmember=member)
            except OrganizationMemberTeam.DoesNotExist:
                return

            self.create_audit_entry(
                request=request,
                organization=team.organization,
                target_object=omt.id,
                target_user_id=member.user_id,
                event=audit_log.get_event_id("MEMBER_LEAVE_TEAM"),
                data=omt.get_audit_log_data(),
            )
            omt.delete()

    def _rename_team_operation(self, request: Request, new_name, team):
        serializer = TeamSerializer(
            team,
            data={"name": new_name, "slug": slugify(new_name)},
            partial=True,
        )
        if not serializer.is_valid():
            raise serializers.ValidationError(serializer.errors)

        team = serializer.save()
        self.create_audit_entry(
            request=request,
            organization=team.organization,
            target_object=team.id,
            event=audit_log.get_event_id("TEAM_EDIT"),
            data=team.get_audit_log_data(),
        )

    @extend_schema(
        operation_id="Update a Team's Attributes",
        parameters=[GlobalParams.ORG_SLUG, SCIMParams.TEAM_ID],
        request=SCIMTeamPatchRequestSerializer,
        responses={
            204: RESPONSE_SUCCESS,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def patch(self, request: Request, organization, team):
        """
        Update a team's attributes with a SCIM Group PATCH Request.
        """

        serializer = SCIMTeamPatchRequestSerializer(data=request.data)

        if not serializer.is_valid():
            raise SCIMApiError(detail=json.dumps(serializer.errors))

        operations = request.data.get("Operations", [])

        if len(operations) > 100:
            return Response(SCIM_400_TOO_MANY_PATCH_OPS_ERROR, status=400)
        try:
            with transaction.atomic(router.db_for_write(OrganizationMemberTeam)):
                team.idp_provisioned = True
                team.save()

                for operation in operations:
                    op = operation["op"].lower()
                    if op == TeamPatchOps.ADD and operation["path"] == "members":
                        self._add_members_operation(request, operation, team)
                    elif op == TeamPatchOps.REMOVE and "members" in operation["path"]:
                        self._remove_members_operation(
                            request, self._get_member_id_for_remove_op(operation), team
                        )
                    elif op == TeamPatchOps.REPLACE:
                        path = operation.get("path")

                        if path == "members":
                            # delete all the current team members
                            # and replace with the ones in the operation list
                            with transaction.atomic(router.db_for_write(OrganizationMember)):
                                existing = list(
                                    OrganizationMemberTeam.objects.filter(team_id=team.id)
                                )
                                OrganizationMemberTeam.objects.bulk_delete(existing)
                                self._add_members_operation(request, operation, team)
                        # azure and okta handle team name change operation differently
                        elif path is None:
                            # for okta
                            self._rename_team_operation(
                                request, operation["value"]["displayName"], team
                            )
                        elif path == "displayName":
                            # for azure
                            self._rename_team_operation(request, operation["value"], team)
                        else:
                            return Response(SCIM_400_UNSUPPORTED_ATTRIBUTE, status=400)

        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist(detail=SCIM_404_USER_RES)
        except IntegrityError as e:
            sentry_sdk.capture_exception(e)
            return Response(SCIM_400_INTEGRITY_ERROR, status=400)

        metrics.incr("sentry.scim.team.update", tags={"organization": organization})
        return self.respond(status=204)

    @extend_schema(
        operation_id="Delete an Individual Team",
        parameters=[GlobalParams.ORG_SLUG, SCIMParams.TEAM_ID],
        request=None,
        responses={
            204: RESPONSE_SUCCESS,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, organization, team) -> Response:
        """
        Delete a team with a SCIM Group DELETE Request.
        """
        metrics.incr("sentry.scim.team.delete")
        return super().delete(request, team)

    def put(self, request: Request, organization, team) -> Response:
        # override parent's put since we don't have puts
        # in SCIM Team routes
        return self.http_method_not_allowed(request)

    def _get_member_id_for_remove_op(self, operation):
        if "value" in operation:
            # azure sends member ids in this format under the key 'value'
            return operation["value"][0]["value"]

        try:
            # grab the filter out of the brackets of the string that looks
            # like so: members[value eq "123124"]
            regex_search = re.search(r"\[(.*?)\]", operation["path"])
            if regex_search is None:
                raise SCIMFilterError
            filter_path = regex_search.groups()[0]
            return parse_filter_conditions(filter_path)
        except SCIMFilterError:
            raise ParseError(detail=SCIM_400_INVALID_FILTER)
