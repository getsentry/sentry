from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationPermission
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import OrganizationMember, OrganizationMemberTeam, Team

ERR_INSUFFICIENT_ROLE = 'You cannot remove a member who has more access than you.'

ERR_ONLY_OWNER = 'You cannot remove the only remaining owner of the organization.'

ERR_UNINVITABLE = 'You cannot send an invitation to a user who is already a full member.'


class OrganizationMemberTeamSerializer(serializers.Serializer):
    isActive = serializers.BooleanField()


class RelaxedOrganizationPermission(OrganizationPermission):
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:delete'],
        'POST': ['org:write', 'org:delete'],
        'PUT': ['org:write', 'org:delete'],

        # DELETE checks for role comparison as you can either remove a member
        # with a lower access role, or yourself, without having the req. scope
        'DELETE': ['org:read', 'org:write', 'org:delete'],
    }


class OrganizationMemberTeamDetailsEndpoint(OrganizationEndpoint):
    permission_classes = [RelaxedOrganizationPermission]

    def put(self, request, organization, member_id, team_slug):
        try:
            om = OrganizationMember.objects.filter(
                organization=organization,
                id=member_id,
            ).select_related('user').get()
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

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
                raise ResourceDoesNotExist
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
        if result.get('isActive') is not None:
            omt.is_active = result['isActive']
            omt.save()

        return Response({
            'slug': team.slug,
            'isActive': omt.is_active,
        }, status=200)
