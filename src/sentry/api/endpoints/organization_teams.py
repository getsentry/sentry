from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.serializers import serialize
from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, Organization, Team
)
from sentry.permissions import can_create_teams


class TeamSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)
    slug = serializers.CharField(max_length=200, required=False)


class OrganizationTeamsEndpoint(Endpoint):
    def get(self, request, organization_slug):
        organization = Organization.objects.get_from_cache(
            slug=organization_slug,
        )

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

    def post(self, request, organization_slug):
        organization = Organization.objects.get_from_cache(
            slug=organization_slug,
        )

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

            AuditLogEntry.objects.create(
                organization=organization,
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_ADD,
                data=team.get_audit_log_data(),
            )

            return Response(serialize(team, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
