from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import Project, Team


class OrganizationProjectsEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization):
        """
        List an organization's projects

        Return a list of projects bound to a organization.

            {method} {path}

        """
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
