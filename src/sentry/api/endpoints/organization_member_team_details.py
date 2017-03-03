from __future__ import absolute_import

from django.db.models import Q
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationPermission
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamWithProjectsSerializer
from sentry.models import (
    AuditLogEntryEvent, OrganizationAccessRequest,
    OrganizationMember, OrganizationMemberTeam, Team
)

ERR_INSUFFICIENT_ROLE = 'You cannot modify a member other than yourself.'


class OrganizationMemberTeamSerializer(serializers.Serializer):
    isActive = serializers.BooleanField()


class RelaxedOrganizationPermission(OrganizationPermission):
    _allowed_scopes = [
        'org:read', 'org:write', 'org:delete',
        'member:read', 'member:write', 'member:delete',
    ]

    scope_map = {
        'GET': _allowed_scopes,
        'POST': _allowed_scopes,
        'PUT': _allowed_scopes,

        # DELETE checks for role comparison as you can either remove a member
        # with a lower access role, or yourself, without having the req. scope
        'DELETE': _allowed_scopes,
    }


class OrganizationMemberTeamDetailsEndpoint(OrganizationEndpoint):
    permission_classes = [RelaxedOrganizationPermission]

    def _can_access(self, request, member):
        # TODO(dcramer): ideally org owners/admins could perform these actions
        if request.is_superuser():
            return True

        if not request.user.is_authenticated():
            return False

        if request.user.id == member.user_id:
            return True

        return False

    def _get_member(self, request, organization, member_id):
        if member_id == 'me':
            queryset = OrganizationMember.objects.filter(
                organization=organization,
                user__id=request.user.id,
                user__is_active=True,
            )
        else:
            queryset = OrganizationMember.objects.filter(
                Q(user__is_active=True) | Q(user__isnull=True),
                organization=organization,
                id=member_id,
            )
        return queryset.select_related('user').get()

    def post(self, request, organization, member_id, team_slug):
        """
        Join a team

        Join or request access to a team.

        If the user is already a member of the team, this will simply return
        a 204.

        If the user needs permission to join the team, an access request will
        be generated and the returned status code will be 202.
        """
        try:
            om = self._get_member(request, organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        if not self._can_access(request, om):
            return Response({'detail': ERR_INSUFFICIENT_ROLE}, status=400)

        try:
            team = Team.objects.get(
                organization=organization,
                slug=team_slug,
            )
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            omt = OrganizationMemberTeam.objects.get(
                team=team,
                organizationmember=om,
            )
        except OrganizationMemberTeam.DoesNotExist:
            if not (request.access.has_scope('org:write') or organization.flags.allow_joinleave):
                omt, created = OrganizationAccessRequest.objects.get_or_create(
                    team=team,
                    member=om,
                )
                if created:
                    omt.send_request_email()
                return Response(status=202)

            omt = OrganizationMemberTeam.objects.create(
                team=team,
                organizationmember=om,
            )
        else:
            return Response(status=204)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=omt.id,
            target_user=om.user,
            event=AuditLogEntryEvent.MEMBER_JOIN_TEAM,
            data=omt.get_audit_log_data(),
        )

        return Response(serialize(
            team, request.user, TeamWithProjectsSerializer()), status=201)

    def delete(self, request, organization, member_id, team_slug):
        """
        Leave a team

        Leave a team.
        """
        try:
            om = self._get_member(request, organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        if not self._can_access(request, om):
            return Response({'detail': ERR_INSUFFICIENT_ROLE}, status=400)

        try:
            team = Team.objects.get(
                organization=organization,
                slug=team_slug,
            )
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            omt = OrganizationMemberTeam.objects.get(
                team=team,
                organizationmember=om,
            )
        except OrganizationMemberTeam.DoesNotExist:
            pass
        else:
            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=omt.id,
                target_user=om.user,
                event=AuditLogEntryEvent.MEMBER_LEAVE_TEAM,
                data=omt.get_audit_log_data(),
            )
            omt.delete()

        return Response(serialize(
            team, request.user, TeamWithProjectsSerializer()), status=200)
