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
    GroupPatchOps,
)
from .utils import OrganizationSCIMTeamPermission, SCIMEndpoint, parse_filter_conditions

delete_logger = logging.getLogger("sentry.deletions.api")


CONFLICTING_SLUG_ERROR = "A team with this slug already exists."


class OrganizationSCIMTeamIndex(SCIMEndpoint, OrganizationTeamsEndpoint):
    permission_classes = (OrganizationSCIMTeamPermission,)

    def team_serializer_for_post(self):
        return TeamSCIMSerializer(expand=["members"])

    def should_add_creator_to_team(self, request):
        return False

    def get(self, request, organization):
        try:
            filter_val = parse_filter_conditions(request.GET.get("filter"))
        except ValueError:
            raise ParseError(detail=SCIM_400_INVALID_FILTER)

        if "members" in request.GET.get("excludedAttributes", []):
            expand = None
        else:
            expand = ["members"]
        queryset = Team.objects.filter(
            organization=organization, status=TeamStatus.VISIBLE
        ).order_by("slug")

        if filter_val:
            queryset = queryset.filter(slug=slugify(filter_val))

        def data_fn(offset, limit):
            return list(queryset[offset : offset + limit])

        def on_results(results):
            results = serialize(results, None, TeamSCIMSerializer(expand=expand))
            return self.list_api_format(request, queryset, results)

        return self.paginate(
            request=request,
            on_results=on_results,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            default_per_page=int(request.GET.get("count", 100)),
            queryset=queryset,
            cursor_cls=SCIMCursor,
        )

    def post(self, request, organization):
        # shim displayName from SCIM api to "slug" in order to work with
        # our regular team index POST
        request.data.update({"slug": slugify(request.data["displayName"])})
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
        context = serialize(team, serializer=TeamSCIMSerializer(expand=["members"]))
        return Response(context)

    def _add_members_operation(self, request, operation, team):
        for member in operation["value"]:
            member = OrganizationMember.objects.get(
                organization=team.organization, id=member["value"]
            )
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

    def _remove_members_operation(self, request, operation, team):
        try:
            # grab the filter out of the brackets of the string that looks
            # like so: members[userName eq "baz@sentry.io"]
            parsed_filter = parse_filter_conditions(
                re.search(r"\[(.*?)\]", operation["path"]).groups()[0]
            )
        except Exception:
            # TODO: log parse error
            raise ParseError(detail=SCIM_400_INVALID_FILTER)
        member = OrganizationMember.objects.get(organization=team.organization, id=parsed_filter[0])
        with transaction.atomic():
            try:
                omt = OrganizationMemberTeam.objects.get(team=team, organizationmember=member)
            except OrganizationMemberTeam.DoesNotExist:
                pass

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
            data={
                "slug": slugify(new_name),
            },
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
        A SCIM Group PATCH request takes a series of operations to peform on a team.
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
                    if op == GroupPatchOps.ADD and operation["path"] == "members":
                        self._add_members_operation(request, operation, team)
                    elif op == GroupPatchOps.REMOVE and "members" in operation["path"]:
                        # the members op contains a filter string like so:
                        # members[userName eq "baz@sentry.io"]
                        self._remove_members_operation(request, operation, team)
                    elif op == GroupPatchOps.REPLACE:
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

        context = serialize(team, serializer=TeamSCIMSerializer())
        return Response(context)

    def delete(self, request, organization, team):
        return super().delete(request, team)

    def put(self, request, organization, team):
        # override parent's put since we dont have puts
        # in SCIM Team routes
        return self.http_method_not_allowed(request)
