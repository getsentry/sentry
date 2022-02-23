import logging
import re

import sentry_sdk
from django.db import IntegrityError, transaction
from django.template.defaultfilters import slugify
from drf_spectacular.utils import OpenApiExample, extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.endpoints.organization_teams import OrganizationTeamsEndpoint
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
    RESPONSE_NOTFOUND,
    RESPONSE_SUCCESS,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.decorators import public
from sentry.apidocs.parameters import GLOBAL_PARAMS, SCIM_PARAMS
from sentry.models import (
    AuditLogEntryEvent,
    OrganizationMember,
    OrganizationMemberTeam,
    Team,
    TeamStatus,
)
from sentry.utils.cursors import SCIMCursor

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
    SCIMEndpoint,
    SCIMFilterError,
    SCIMQueryParamSerializer,
    parse_filter_conditions,
    scim_response_envelope,
)

delete_logger = logging.getLogger("sentry.deletions.api")


class SCIMTeamPatchOperationSerializer(serializers.Serializer):
    op = serializers.ChoiceField(choices=("replace", "remove", "add"), required=True)
    value = serializers.ListField(serializers.DictField(), allow_empty=True)
    # TODO: define exact schema for value
    # TODO: actually use these in the patch request for validation


class SCIMTeamPatchRequestSerializer(serializers.Serializer):
    # we don't actually use "schemas" for anything atm but its part of the spec
    schemas = serializers.ListField(child=serializers.CharField(), required=True)

    Operations = serializers.ListField(
        child=SCIMTeamPatchOperationSerializer(), required=True, source="operations"
    )


def _team_expand(excluded_attributes):
    return None if "members" in excluded_attributes else ["members"]


@public(methods={"GET", "POST"})
class OrganizationSCIMTeamIndex(SCIMEndpoint, OrganizationTeamsEndpoint):
    permission_classes = (OrganizationSCIMTeamPermission,)

    def team_serializer_for_post(self):
        return TeamSCIMSerializer(expand=["members"])

    def should_add_creator_to_team(self, request: Request):
        return False

    @extend_schema(
        operation_id="List an Organization's Paginated Teams",
        parameters=[GLOBAL_PARAMS.ORG_SLUG, SCIMQueryParamSerializer],
        request=None,
        responses={
            200: scim_response_envelope(
                "SCIMTeamIndexResponse", OrganizationTeamSCIMSerializerResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
        examples=[  # TODO: see if this can go on serializer object instead
            OpenApiExample(
                "listGroups",
                value={
                    "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
                    "totalResults": 1,
                    "startIndex": 1,
                    "itemsPerPage": 1,
                    "Resources": [
                        {
                            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                            "id": "23232",
                            "displayName": "test-scimv2",
                            "members": [],
                            "meta": {"resourceType": "Group"},
                        }
                    ],
                },
                status_codes=["200"],
            ),
        ],
    )
    def get(self, request: Request, organization) -> Response:
        """
        Returns a paginated list of teams bound to a organization with a SCIM Groups GET Request.
        - Note that the members field will only contain up to 10000 members.
        """

        query_params = self.get_query_parameters(request)

        queryset = Team.objects.filter(
            organization=organization, status=TeamStatus.VISIBLE
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
            queryset=queryset,
            cursor_cls=SCIMCursor,
        )

    @extend_schema(
        operation_id="Provision a New Team",
        parameters=[GLOBAL_PARAMS.ORG_SLUG],
        request=inline_serializer(
            "SCIMTeamRequestBody",
            fields={
                "schemas": serializers.ListField(serializers.CharField()),
                "displayName": serializers.CharField(),
                "members": serializers.ListField(serializers.IntegerField()),
            },
        ),
        responses={
            201: TeamSCIMSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
        examples=[  # TODO: see if this can go on serializer object instead
            OpenApiExample(
                "provisionTeam",
                response_only=True,
                value={
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                    "displayName": "Test SCIMv2",
                    "members": [],
                    "meta": {"resourceType": "Group"},
                    "id": "123",
                },
                status_codes=["201"],
            ),
        ],
    )
    def post(self, request: Request, organization) -> Response:
        """
        Create a new team bound to an organization via a SCIM Groups POST Request.
        Note that teams are always created with an empty member set.
        The endpoint will also do a normalization of uppercase / spaces to lowercase and dashes.
        """
        # shim displayName from SCIM api in order to work with
        # our regular team index POST
        request.data.update(
            {"name": request.data["displayName"], "slug": slugify(request.data["displayName"])}
        ),
        return super().post(request, organization)


@public(methods={"GET", "PATCH"})
class OrganizationSCIMTeamDetails(SCIMEndpoint, TeamDetailsEndpoint):
    permission_classes = (OrganizationSCIMTeamPermission,)

    def convert_args(self, request: Request, organization_slug, team_id, *args, **kwargs):
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
        if team.status != TeamStatus.VISIBLE:
            raise Team.DoesNotExist
        return team

    @extend_schema(
        operation_id="Query an Individual Team",
        parameters=[SCIM_PARAMS.TEAM_ID, GLOBAL_PARAMS.ORG_SLUG],
        request=None,
        responses={
            200: TeamSCIMSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
        examples=[  # TODO: see if this can go on serializer object instead
            OpenApiExample(
                "Successful response",
                value={
                    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                    "id": "23232",
                    "displayName": "test-scimv2",
                    "members": [],
                    "meta": {"resourceType": "Group"},
                },
            ),
        ],
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

            with transaction.atomic():
                omt = OrganizationMemberTeam.objects.create(team=team, organizationmember=member)
                self.create_audit_entry(
                    request=request,
                    organization=team.organization,
                    target_object=omt.id,
                    target_user=member.user,
                    event=AuditLogEntryEvent.MEMBER_JOIN_TEAM,
                    data=omt.get_audit_log_data(),
                )

    def _remove_members_operation(self, request: Request, member_id, team):
        member = OrganizationMember.objects.get(organization=team.organization, id=member_id)
        with transaction.atomic():
            try:
                omt = OrganizationMemberTeam.objects.get(team=team, organizationmember=member)
            except OrganizationMemberTeam.DoesNotExist:
                return

            self.create_audit_entry(
                request=request,
                organization=team.organization,
                target_object=omt.id,
                target_user=member.user,
                event=AuditLogEntryEvent.MEMBER_LEAVE_TEAM,
                data=omt.get_audit_log_data(),
            )
            omt.delete()

    def _rename_team_operation(self, request: Request, new_name, team):
        serializer = TeamSerializer(
            team,
            data={"name": new_name, "slug": slugify(new_name)},
            partial=True,
        )
        if serializer.is_valid():
            team = serializer.save()
            self.create_audit_entry(
                request=request,
                organization=team.organization,
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_EDIT,
                data=team.get_audit_log_data(),
            )

    @extend_schema(
        operation_id="Update a Team's Attributes",
        parameters=[GLOBAL_PARAMS.ORG_SLUG, SCIM_PARAMS.TEAM_ID],
        request=SCIMTeamPatchRequestSerializer,
        responses={
            204: RESPONSE_SUCCESS,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def patch(self, request: Request, organization, team):
        """
        A SCIM Group PATCH request takes a series of operations to perform on a team.
        It does them sequentially and if any of them fail no operations should go through.
        The operations are add members, remove members, replace members, and rename team.
        Update a team's attributes with a SCIM Group PATCH Request. Valid Operations are:
        * Renaming a team:
        ```json
        {
            "op": "replace",
            "value": {
                "id": 23,
                "displayName": "newName"
            }
        }
        ```
        * Adding a member to a team:
        ```json
        {
            "op": "add",
            "path": "members",
            "value": [
                {
                    "value": 23,
                    "display": "testexample@example.com"
                }
            ]
        }
        ```
        * Removing a member from a team:
        ```json
        {
            "op": "remove",
            "path": "members[value eq \"23\"]"
        }
        ```
        * Replacing an entire member set of a team:
        ```json
        {
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
        }
        ```
        """
        operations = request.data.get("Operations", [])
        if len(operations) > 100:
            return Response(SCIM_400_TOO_MANY_PATCH_OPS_ERROR, status=400)
        try:
            with transaction.atomic():
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
                            with transaction.atomic():
                                queryset = OrganizationMemberTeam.objects.filter(team_id=team.id)
                                queryset.delete()
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

        return self.respond(status=204)

    @extend_schema(
        operation_id="Delete an Individual Team",
        parameters=[GLOBAL_PARAMS.ORG_SLUG, SCIM_PARAMS.TEAM_ID],
        request=None,
        responses={
            204: RESPONSE_SUCCESS,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOTFOUND,
        },
    )
    def delete(self, request: Request, organization, team) -> Response:
        """
        Delete a team with a SCIM Group DELETE Request.
        """
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
