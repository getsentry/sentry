from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import serialize
from sentry.models import Project


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ('name', 'slug')


class TeamProjectIndexEndpoint(TeamEndpoint):
    doc_section = DocSection.TEAMS

    def get(self, request, team):
        """
        List a team's projects

        Return a list of projects bound to a team.

            {method} {path}

        """
        results = list(Project.objects.get_for_user(team=team, user=request.user))

        return Response(serialize(results, request.user))

    def post(self, request, team):
        """
        Create a new project

        Create a new project bound to a team.

            {method} {path}
            {{
                "name": "My project"
            }}

        """
        serializer = ProjectSerializer(data=request.DATA)

        if serializer.is_valid():
            project = serializer.object
            project.team = team
            project.organization = team.organization
            project.save()
            return Response(serialize(project, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
