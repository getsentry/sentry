from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import Project


class OrganizationProjectsEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization):
        """
        List an organization's projects

        Return a list of projects bound to a organization.

            {method} {path}

        """
        if request.auth and hasattr(request.auth, 'project'):
            team_list = [request.auth.project.team]
            project_list = [request.auth.project]
        else:
            team_list = list(request.access.teams)
            project_list = list(Project.objects.filter(
                team__in=team_list,
            ).order_by('name'))

        team_map = dict(
            (t.id, c) for (t, c) in zip(team_list, serialize(team_list, request.user)),
        )

        context = []
        for project, pdata in zip(project_list, serialize(project_list, request.user)):
            pdata['team'] = team_map[project.team_id]
            context.append(pdata)

        return Response(context)
