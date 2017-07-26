from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import ProjectWithTeamSerializer
from sentry.models import Project, Team
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ListOrganizationProjects')
def list_organization_projects_scenario(runner):
    runner.request(method='GET', path='/organizations/%s/projects/' % runner.org.slug)


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
        if request.auth and not request.user.is_authenticated():
            # TODO: remove this, no longer supported probably
            if hasattr(request.auth, 'project'):
                team_list = [request.auth.project.team]
                queryset = queryset = Project.objects.filter(
                    id=request.auth.project.id,
                ).select_related('team')
            elif request.auth.organization is not None:
                org = request.auth.organization
                team_list = list(Team.objects.filter(
                    organization=org,
                ))
                queryset = Project.objects.filter(
                    team__in=team_list,
                ).select_related('team')
            else:
                return Response(
                    {
                        'detail': 'Current access does not point to '
                        'organization.'
                    }, status=400
                )
        else:
            team_list = list(request.access.teams)
            queryset = Project.objects.filter(
                team__in=team_list,
            ).select_related('team')

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='slug',
            on_results=lambda x: serialize(x, request.user, ProjectWithTeamSerializer()),
            paginator_cls=OffsetPaginator,
        )
