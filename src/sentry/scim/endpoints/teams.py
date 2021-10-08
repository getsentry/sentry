import logging
import re

import sentry_sdk
from django.db import IntegrityError, transaction
from django.template.defaultfilters import slugify
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.endpoints.organization_teams import OrganizationTeamsEndpoint
from sentry.api.endpoints.team_details import TeamDetailsEndpoint, TeamSerializer
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamSCIMSerializer
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
    parse_filter_conditions,
)

delete_logger = logging.getLogger("sentry.deletions.api")


def _team_expand(excluded_attributes):
    return None if "members" in excluded_attributes else ["members"]


class OrganizationSCIMTeamIndex(SCIMEndpoint, OrganizationTeamsEndpoint):
    permission_classes = (OrganizationSCIMTeamPermission,)

    def team_serializer_for_post(self):
        return TeamSCIMSerializer(expand=["members"])

    def should_add_creator_to_team(self, request):
        return False

    def get(self, request, organization):

        query_params = self.get_query_parameters(request)

        queryset = Team.objects.filter(
            organization=organization, status=TeamStatus.VISIBLE
        ).order_by("slug")
        if query_params["filter"]:
            queryset = queryset.filter(name__iexact=query_params["filter"])

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

    def post(self, request, organization):
        # shim displayName from SCIM api in order to work with
        # our regular team index POST
        request.data.update(
            {"name": request.data["displayName"], "slug": slugify(request.data["displayName"])}
        ),
        return super().post(request, organization)


class OrganizationSCIMTeamDetails(SCIMEndpoint, TeamDetailsEndpoint):
    permission_classes = (OrganizationSCIMTeamPermission,)

    def convert_args(self, request, organization_slug, team_id, *args, **kwargs):
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

    def get(self, request, organization, team):
        query_params = self.get_query_parameters(request)

        context = serialize(
            team,
            serializer=TeamSCIMSerializer(expand=_team_expand(query_params["excluded_attributes"])),
        )
        return Response(context)

    def _add_members_operation(self, request, operation, team):
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

    def _remove_members_operation(self, request, member_id, team):
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

    def _rename_team_operation(self, request, new_name, team):
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

    def patch(self, request, organization, team):
        """
        A SCIM Group PATCH request takes a series of operations to perform on a team.
        It does them sequentially and if any of them fail no operations should go through.
        The operations are add members, remove members, replace members, and rename team.
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

    def delete(self, request, organization, team):
        return super().delete(request, team)

    def put(self, request, organization, team):
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
