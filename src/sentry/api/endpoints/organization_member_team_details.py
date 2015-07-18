from __future__ import absolute_import

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
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:delete'],
        'POST': ['org:read', 'org:write', 'org:delete'],
        'PUT': ['org:read', 'org:write', 'org:delete'],

        # DELETE checks for role comparison as you can either remove a member
        # with a lower access role, or yourself, without having the req. scope
        'DELETE': ['org:read', 'org:write', 'org:delete'],
    }


class OrganizationMemberTeamDetailsEndpoint(OrganizationEndpoint):
    permission_classes = [RelaxedOrganizationPermission]

    def _can_access(self, request, member):
        # TODO(dcramer): ideally org owners/admins could perform these actions
        if request.user.is_superuser:
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
            )
        else:
            queryset = OrganizationMember.objects.filter(
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

        if not om.has_global_access:
            try:
                omt = OrganizationMemberTeam.objects.get(
                    team=team,
                    organizationmember=om,
                )
            except OrganizationMemberTeam.DoesNotExist:
                # TODO(dcramer): this should create a pending request and
                # return a 202
                if not organization.flags.allow_joinleave:
                    omt, created = OrganizationAccessRequest.objects.get_or_create(
                        team=team,
                        member=om,
                    )
                    if created:
                        omt.send_request_email()
                    return Response(status=202)

                omt = OrganizationMemberTeam(
                    team=team,
                    organizationmember=om,
                    is_active=False,
                )

            if omt.is_active:
                return Response(status=204)
        else:
            try:
                omt = OrganizationMemberTeam.objects.get(
                    team=team,
                    organizationmember=om,
                )
            except OrganizationMemberTeam.DoesNotExist:
                # if the relationship doesnt exist, they're already a member
                return Response(status=204)

        omt.is_active = True
        omt.save()

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

        if not om.has_global_access:
            try:
                omt = OrganizationMemberTeam.objects.get(
                    team=team,
                    organizationmember=om,
                )
            except OrganizationMemberTeam.DoesNotExist:
                # if the relationship doesnt exist, they're already a member
                return Response(serialize(
                    team, request.user, TeamWithProjectsSerializer()), status=200)
        else:
            try:
                omt = OrganizationMemberTeam.objects.get(
                    team=team,
                    organizationmember=om,
                    is_active=True,
                )
            except OrganizationMemberTeam.DoesNotExist:
                omt = OrganizationMemberTeam(
                    team=team,
                    organizationmember=om,
                    is_active=True,
                )

        if omt.is_active:
            omt.is_active = False
            omt.save()

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=omt.id,
                target_user=om.user,
                event=AuditLogEntryEvent.MEMBER_LEAVE_TEAM,
                data=omt.get_audit_log_data(),
            )

        return Response(serialize(
            team, request.user, TeamWithProjectsSerializer()), status=200)
