from typing import Any, Mapping, MutableMapping

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, roles
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationMemberEndpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.models.team import TeamSerializer, TeamWithProjectsSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    Organization,
    OrganizationAccessRequest,
    OrganizationMember,
    OrganizationMemberTeam,
    Team,
)
from sentry.roles import team_roles
from sentry.roles.manager import TeamRole
from sentry.utils import metrics
from sentry.utils.json import JSONData

from . import can_admin_team, can_set_team_role

ERR_INSUFFICIENT_ROLE = "You do not have permission to edit that user's membership."


class OrganizationMemberTeamSerializer(serializers.Serializer):
    isActive = serializers.BooleanField()
    teamRole = serializers.CharField(allow_null=True, allow_blank=True)


class OrganizationMemberTeamDetailsSerializer(Serializer):
    def serialize(
        self, obj: OrganizationMemberTeam, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> MutableMapping[str, JSONData]:
        return {
            "isActive": obj.is_active,
            "teamRole": obj.role,
        }


class RelaxedOrganizationPermission(OrganizationPermission):
    _allowed_scopes = [
        "org:read",
        "org:write",
        "org:admin",
        "member:read",
        "member:write",
        "member:admin",
    ]

    scope_map = {
        "GET": _allowed_scopes,
        "POST": _allowed_scopes,
        "PUT": _allowed_scopes,
        "DELETE": _allowed_scopes,
    }


@region_silo_endpoint
class OrganizationMemberTeamDetailsEndpoint(OrganizationMemberEndpoint):
    permission_classes = [RelaxedOrganizationPermission]

    def _can_create_team_member(self, request: Request, team: Team) -> bool:
        """
        User can join or add a member to a team:

        * If they are an active superuser
        * If they are a team admin or have global write access
        * If the open membership organization setting is enabled
        """
        return request.access.has_global_access or can_admin_team(request.access, team)

    def _can_delete(
        self,
        request: Request,
        member: OrganizationMember,
        team: Team,
    ) -> bool:
        """
        User can remove a member from a team:

        * If they are an active superuser
        * If they are removing their own membership
        * If they are a team admin or have global write access
        """
        if is_active_superuser(request):
            return True

        if not request.user.is_authenticated:
            return False

        if request.user.id == member.user_id:
            return True

        return can_admin_team(request.access, team)

    def _create_access_request(
        self, request: Request, team: Team, member: OrganizationMember
    ) -> None:
        omt, created = OrganizationAccessRequest.objects.get_or_create(team=team, member=member)

        if not created:
            return

        requester = request.user.id if request.user.id != member.user_id else None
        if requester:
            omt.update(requester_id=requester)

        omt.send_request_email()

    def get(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
        team_slug: str,
    ) -> Response:
        omt = None
        try:
            omt = OrganizationMemberTeam.objects.get(
                team__slug=team_slug, organizationmember=member
            )
        except OrganizationMemberTeam.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(
            serialize(omt, request.user, OrganizationMemberTeamDetailsSerializer()), status=200
        )

    def post(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
        team_slug: str,
    ) -> Response:
        """
        Join, request access to or add a member to a team.

        If the user needs permission to join the team, an access request will
        be generated and the returned status code will be 202.

        If the user is already a member of the team, this will simply return
        a 204.

        If the team is provisioned through an identity provider, then the user
        cannot join or request to join the team through Sentry.
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        try:
            team = Team.objects.get(organization=organization, slug=team_slug)
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        if OrganizationMemberTeam.objects.filter(team=team, organizationmember=member).exists():
            return Response(status=204)

        if team.idp_provisioned:
            return Response(
                {"detail": "This team is managed through your organization's identity provider."},
                status=403,
            )

        if not self._can_create_team_member(request, team):
            self._create_access_request(request, team, member)
            return Response(status=202)

        omt = OrganizationMemberTeam.objects.create(team=team, organizationmember=member)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=omt.id,
            target_user=member.user,
            event=audit_log.get_event_id("MEMBER_JOIN_TEAM"),
            data=omt.get_audit_log_data(),
        )

        return Response(serialize(team, request.user, TeamWithProjectsSerializer()), status=201)

    def put(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
        team_slug: str,
    ) -> Response:
        try:
            team = Team.objects.get(organization=organization, slug=team_slug)
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        omt = None
        try:
            omt = OrganizationMemberTeam.objects.get(team=team, organizationmember=member)
        except OrganizationMemberTeam.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = OrganizationMemberTeamSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(status=400)
        result = serializer.validated_data

        if "teamRole" in result and features.has("organizations:team-roles", organization):
            new_role_id = result["teamRole"]
            try:
                new_role = team_roles.get(new_role_id)
            except KeyError:
                return Response(status=400)

            if not can_set_team_role(request.access, team, new_role):
                return Response({"detail": ERR_INSUFFICIENT_ROLE}, status=400)

            self._change_team_member_role(omt, new_role)

        return Response(
            serialize(omt, request.user, OrganizationMemberTeamDetailsSerializer()), status=200
        )

    @staticmethod
    def _change_team_member_role(
        team_membership: OrganizationMemberTeam, team_role: TeamRole
    ) -> None:
        """Modify a member's team-level role."""
        minimum_team_role = roles.get_minimum_team_role(team_membership.organizationmember.role)
        if team_role.priority > minimum_team_role.priority:
            applying_minimum = False
            team_membership.update(role=team_role.id)
        else:
            # The new team role is redundant to the role that this member would
            # receive as their minimum team role anyway. This makes it effectively
            # invisible in the UI, and it would be surprising if it were suddenly
            # left over after the user's org-level role is demoted. So, write a null
            # value to the database and let the minimum team role take over.
            applying_minimum = True
            team_membership.update(role=None)

        metrics.incr(
            "team_roles.assign",
            tags={"target_team_role": team_role.id, "applying_minimum": str(applying_minimum)},
        )

    def delete(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
        team_slug: str,
    ) -> Response:
        """
        Leave or remove a member from a team
        """
        try:
            team = Team.objects.get(organization=organization, slug=team_slug)
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        if not self._can_delete(request, member, team):
            return Response({"detail": ERR_INSUFFICIENT_ROLE}, status=400)

        if team.idp_provisioned:
            return Response(
                {"detail": "This team is managed through your organization's identity provider."},
                status=403,
            )

        omt = None
        try:
            omt = OrganizationMemberTeam.objects.get(team=team, organizationmember=member)
        except OrganizationMemberTeam.DoesNotExist:
            pass

        else:
            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=omt.id,
                target_user=member.user,
                event=audit_log.get_event_id("MEMBER_LEAVE_TEAM"),
                data=omt.get_audit_log_data(),
            )
            omt.delete()

        return Response(
            serialize(team, request.user, TeamSerializer(expand=["externalTeams"])), status=200
        )
