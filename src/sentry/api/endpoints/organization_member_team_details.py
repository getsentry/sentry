from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationPermission
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import OrganizationMember, OrganizationMemberTeam, Team

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

        if request.user.id == member.user_id:
            return True

        return False

    def put(self, request, organization, member_id, team_slug):
        try:
            om = OrganizationMember.objects.filter(
                organization=organization,
                id=member_id,
            ).select_related('user').get()
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
                if not organization.flags.allow_joinleave:
                    raise ResourceDoesNotExist
                omt = OrganizationMemberTeam(
                    team=team,
                    organizationmember=om,
                    is_active=False,
                )
        else:
            try:
                omt = OrganizationMemberTeam.objects.get(
                    team=team,
                    organizationmember=om,
                )
            except OrganizationMemberTeam.DoesNotExist:
                omt = OrganizationMemberTeam(
                    team=team,
                    organizationmember=om,
                )

        serializer = OrganizationMemberTeamSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object
        if result.get('isActive') is not None and result['isActive'] != omt.is_active:
            omt.is_active = result['isActive']
            omt.save()

        return Response({
            'slug': team.slug,
            'isActive': omt.is_active,
        }, status=200)
