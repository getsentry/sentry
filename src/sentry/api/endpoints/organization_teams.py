from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntry, AuditLogEntryEvent, Team
from sentry.permissions import can_create_teams


class TeamSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)
    slug = serializers.CharField(max_length=200, required=False)


class OrganizationTeamsEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization):
        """
        List an organization's teams

        Return a list of teams bound to a organization.

            {method} {path}

        """
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

    def post(self, request, organization):
        """
        Create a new team

        Create a new team bound to an organization.

            {method} {path}
            {{
                "name": "My team"
            }}

        """
        if not can_create_teams(request.user, organization):
            return Response(status=403)

        serializer = TeamSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            team = Team.objects.create(
                name=result['name'],
                slug=result.get('slug'),
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
