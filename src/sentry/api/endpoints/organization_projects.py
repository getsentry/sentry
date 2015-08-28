from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import Project, Team
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ListOrganizationProjects')
def list_organization_projects_scenario(runner):
    runner.request(
        method='GET',
        path='/organizations/%s/projects/' % runner.org.slug
    )


class OrganizationProjectsEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    @attach_scenarios([list_organization_projects_scenario])
    def get(self, request, organization):
        """
        List an Organization's Projects
        ```````````````````````````````

        Return a list of projects bound to a organization.

        :pparam string organization_slug: the slug of the organization for
                                          which the projects should be listed.
        :auth: required
        """
        if request.auth:
            # TODO: remove this, no longer supported probably
            if hasattr(request.auth, 'project'):
                team_list = [request.auth.project.team]
                project_list = [request.auth.project]
            else:
                org = request.auth.organization
                team_list = list(Team.objects.filter(
                    organization=org,
                ))
                project_list = list(Project.objects.filter(
                    team__in=team_list,
                ).order_by('name'))
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
