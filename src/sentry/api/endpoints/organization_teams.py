from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamWithProjectsSerializer
from sentry.models import AuditLogEntryEvent, Team, TeamStatus


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
        # TODO(dcramer): this should be system-wide default for organization
        # based endpoints
        if request.auth and hasattr(request.auth, 'project'):
            return Response(status=403)

        team_list = list(Team.objects.filter(
            organization=organization,
            status=TeamStatus.VISIBLE,
        ).order_by('name', 'slug'))

        return Response(serialize(
            team_list, request.user, TeamWithProjectsSerializer()))

    def post(self, request, organization):
        """
        Create a new team

        Create a new team bound to an organization.

            {method} {path}
            {{
                "name": "My team"
            }}

        """
        serializer = TeamSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            team = Team.objects.create(
                name=result['name'],
                slug=result.get('slug'),
                organization=organization,
            )

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=team.id,
                event=AuditLogEntryEvent.TEAM_ADD,
                data=team.get_audit_log_data(),
            )

            return Response(serialize(team, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
