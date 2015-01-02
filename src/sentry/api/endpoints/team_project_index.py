from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.constants import MEMBER_ADMIN
from sentry.models import Team, Project
from sentry.permissions import can_create_projects


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ('name', 'slug')


class TeamProjectIndexEndpoint(Endpoint):
    def get(self, request, team_id):
        team = Team.objects.get_from_cache(id=team_id)

        assert_perm(team, request.user, request.auth)

        results = list(Project.objects.get_for_user(team=team, user=request.user))

        return Response(serialize(results, request.user))

    def post(self, request, team_id):
        team = Team.objects.get_from_cache(id=team_id)

        assert_perm(team, request.user, request.auth, access=MEMBER_ADMIN)

        if not can_create_projects(user=request.user, team=team):
            return Response(status=403)

        serializer = ProjectSerializer(data=request.DATA)

        if serializer.is_valid():
            project = serializer.object
            project.team = team
            project.organization = team.organization
            project.save()
            return Response(serialize(project, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
