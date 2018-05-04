from __future__ import absolute_import

import six

from django.db.models import Q
from rest_framework.response import Response

from sentry.api.base import DocSection, EnvironmentMixin
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import ProjectSummarySerializer
from sentry.models import Project, Team
from sentry.search.utils import tokenize_query
from sentry.utils.apidocs import scenario, attach_scenarios

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', '14d', and '30d'"


@scenario('ListOrganizationProjects')
def list_organization_projects_scenario(runner):
    runner.request(method='GET', path='/organizations/%s/projects/' % runner.org.slug)


class OrganizationProjectsEndpoint(OrganizationEndpoint, EnvironmentMixin):
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
        stats_period = request.GET.get('statsPeriod')
        if stats_period not in (None, '', '24h', '14d', '30d'):
            return Response(
                {
                    'error': {
                        'params': {
                            'stats_period': {
                                'message': ERR_INVALID_STATS_PERIOD
                            },
                        },
                    }
                },
                status=400
            )
        elif not stats_period:
            # disable stats
            stats_period = None

        if request.auth and not request.user.is_authenticated():
            # TODO: remove this, no longer supported probably
            if hasattr(request.auth, 'project'):
                team_list = list(request.auth.project.teams.all())
                queryset = Project.objects.filter(
                    id=request.auth.project.id,
                ).prefetch_related('teams')
            elif request.auth.organization is not None:
                org = request.auth.organization
                team_list = list(Team.objects.filter(
                    organization=org,
                ))
                queryset = Project.objects.filter(
                    teams__in=team_list,
                ).prefetch_related('teams')
            else:
                return Response(
                    {
                        'detail': 'Current access does not point to '
                        'organization.'
                    }, status=400
                )
        else:
            queryset = Project.objects.filter(
                organization=organization,
            ).prefetch_related('teams')

        query = request.GET.get('query')
        if query:
            tokens = tokenize_query(query)
            for key, value in six.iteritems(tokens):
                if key == 'query':
                    value = ' '.join(value)
                    queryset = queryset.filter(Q(name__icontains=value) | Q(slug__icontains=value))
                elif key == 'id':
                    queryset = queryset.filter(id__in=value)
                else:
                    queryset = queryset.none()

        queryset = queryset.distinct()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='slug',
            on_results=lambda x: serialize(x, request.user, ProjectSummarySerializer(
                environment_id=self._get_environment_id_from_request(
                    request,
                    organization.id,
                ),
                stats_period=stats_period,
            )),
            paginator_cls=OffsetPaginator,
        )
