from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.models import Organization, Team
from sentry.permissions import can_create_teams


class TeamSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)
    slug = serializers.CharField(max_length=200, required=False)


class OrganizationTeamsEndpoint(Endpoint):
    def get_organization(self, request, organization_id):
        organization_id = str(organization_id)
        try:
            return (
                o for o in Organization.objects.get_for_user(
                    user=request.user,
                )
                if str(o.id) == organization_id
            ).next()
        except StopIteration:
            return

    def get(self, request, organization_id):
        organization = self.get_organization(request, organization_id)
        if organization is None:
            return Response(status=403)

        if request.auth:
            teams = [request.auth.project.team]
            if teams[0].organization != organization:
                return Response(status=403)
        else:
            teams = Team.objects.get_for_user(
                organization=organization,
                user=request.user,
            )
        return Response(serialize(teams, request.user))

    def post(self, request, organization_id):
        organization = self.get_organization(request, organization_id)
        if organization is None:
            return Response(status=403)

        if not can_create_teams(request.user, organization):
            return Response(status=403)

        serializer = TeamSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object
            team = Team.objects.create(
                name=result['name'],
                slug=result.get('slug'),
                owner=result.get('owner') or organization.owner,
                organization=organization,
            )
            return Response(serialize(team, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
