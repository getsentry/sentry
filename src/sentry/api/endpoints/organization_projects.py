from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import Organization, Project, Team


class OrganizationProjectsEndpoint(Endpoint):
    def get(self, request, organization_slug):
        organization = Organization.objects.get_from_cache(
            slug=organization_slug,
        )

        assert_perm(organization, request.user, request.auth)

        team_list = Team.objects.get_for_user(
            organization=organization,
            user=request.user,
        )

        project_list = []
        for team in team_list:
            project_list.extend(Project.objects.get_for_user(
                team=team,
                user=request.user,
            ))
        project_list.sort(key=lambda x: x.name)

        team_map = dict(
            (t.id, c) for (t, c) in zip(team_list, serialize(team_list, request.user)),
        )

        context = []
        for project, pdata in zip(project_list, serialize(project_list, request.user)):
            pdata['team'] = team_map[project.team_id]
            context.append(pdata)

        return Response(context)
