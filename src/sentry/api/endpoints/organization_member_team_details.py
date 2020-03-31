from __future__ import absolute_import

from django.db.models import Q
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import roles
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamWithProjectsSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    AuditLogEntryEvent,
    OrganizationAccessRequest,
    OrganizationMember,
    OrganizationMemberTeam,
    Team,
)

ERR_INSUFFICIENT_ROLE = "You do not have permission to edit that user's membership."


class OrganizationMemberTeamSerializer(serializers.Serializer):
    isActive = serializers.BooleanField()


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


class OrganizationMemberTeamDetailsEndpoint(OrganizationEndpoint):
    permission_classes = [RelaxedOrganizationPermission]

    def _can_create_team_member(self, request, organization, team_slug):
        """
        User can join or add a member to a team:

        * If they are an active superuser
        * If they are a team admin or have global write access
        * If the open membership organization setting is enabled
        """

        return (
            is_active_superuser(request)
            or self._can_admin_team(request, organization, team_slug)
            or organization.flags.allow_joinleave
        )

    def _can_delete(self, request, member, organization, team_slug):
        """
        User can remove a member from a team:

        * If they are an active superuser
        * If they are removing their own membership
        * If they are a team admin or have global write access
        """

        if is_active_superuser(request):
            return True

        if not request.user.is_authenticated():
            return False

        if request.user.id == member.user_id:
            return True

        if self._can_admin_team(request, organization, team_slug):
            return True

        return False

    def _can_admin_team(self, request, organization, team_slug):
        global_roles = [r.id for r in roles.with_scope("org:write") if r.is_global]
        team_roles = [r.id for r in roles.with_scope("team:write")]

        # must be a team admin or have global write access
        return OrganizationMember.objects.filter(
            Q(role__in=global_roles)
            | Q(organizationmemberteam__team__slug=team_slug, role__in=team_roles),
            organization=organization,
            user__id=request.user.id,
            user__is_active=True,
        ).exists()

    def _get_member(self, request, organization, member_id):
        if member_id == "me":
            queryset = OrganizationMember.objects.filter(
                organization=organization, user__id=request.user.id, user__is_active=True
            )
        else:
            queryset = OrganizationMember.objects.filter(
                Q(user__is_active=True) | Q(user__isnull=True),
                organization=organization,
                id=member_id,
            )
        return queryset.select_related("user").get()

    def _create_access_request(self, request, team, member):
        omt, created = OrganizationAccessRequest.objects.get_or_create(team=team, member=member)

        if not created:
            return

        requester = request.user if request.user != member.user else None
        if requester:
            omt.update(requester=requester)

        omt.send_request_email()

    def post(self, request, organization, member_id, team_slug):
        """
        Join, request access to or add a member to a team.

        If the user needs permission to join the team, an access request will
        be generated and the returned status code will be 202.

        If the user is already a member of the team, this will simply return
        a 204.
        """
        try:
            member = self._get_member(request, organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        if not request.user.is_authenticated():
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        try:
            team = Team.objects.get(organization=organization, slug=team_slug)
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            omt = OrganizationMemberTeam.objects.get(team=team, organizationmember=member)
        except OrganizationMemberTeam.DoesNotExist:
            if self._can_create_team_member(request, organization, team_slug):
                omt = OrganizationMemberTeam.objects.create(team=team, organizationmember=member)
            else:
                self._create_access_request(request, team, member)
                return Response(status=202)

        else:
            return Response(status=204)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=omt.id,
            target_user=member.user,
            event=AuditLogEntryEvent.MEMBER_JOIN_TEAM,
            data=omt.get_audit_log_data(),
        )

        return Response(serialize(team, request.user, TeamWithProjectsSerializer()), status=201)

    def delete(self, request, organization, member_id, team_slug):
        """
        Leave or remove a member from a team
        """
        try:
            member = self._get_member(request, organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        if not self._can_delete(request, member, organization, team_slug):
            return Response({"detail": ERR_INSUFFICIENT_ROLE}, status=400)

        try:
            team = Team.objects.get(organization=organization, slug=team_slug)
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

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
                event=AuditLogEntryEvent.MEMBER_LEAVE_TEAM,
                data=omt.get_audit_log_data(),
            )
            omt.delete()

        return Response(serialize(team, request.user, TeamWithProjectsSerializer()), status=200)
