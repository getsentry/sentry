from __future__ import absolute_import

import six

from django.db.models import Q

from sentry.api.base import DocSection, Endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize, ProjectWithOrganizationSerializer
from sentry.db.models.query import in_iexact
from sentry.models import (
    Project, ProjectPlatform, ProjectStatus
)
from sentry.search.utils import tokenize_query
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ListYourProjects')
def list_your_projects_scenario(runner):
    runner.request(
        method='GET',
        path='/projects/'
    )


class ProjectIndexEndpoint(Endpoint):
    doc_section = DocSection.PROJECTS
    permission_classes = (ProjectPermission,)

    @attach_scenarios([list_your_projects_scenario])
    def get(self, request):
        """
        List your Projects
        ``````````````````

        Return a list of projects available to the authenticated
        session.

        :auth: required
        """
        queryset = Project.objects.select_related('organization').distinct()

        status = request.GET.get('status', 'active')
        if status == 'active':
            queryset = queryset.filter(
                status=ProjectStatus.VISIBLE,
            )
        elif status == 'deleted':
            queryset = queryset.exclude(
                status=ProjectStatus.VISIBLE,
            )
        elif status:
            queryset = queryset.none()

        if request.auth and not request.user.is_authenticated():
            if hasattr(request.auth, 'project'):
                queryset = queryset.filter(
                    id=request.auth.project_id,
                )
            elif request.auth.organization is not None:
                queryset = queryset.filter(
                    organization=request.auth.organization.id,
                )
            else:
                queryset = queryset.none()
        elif not request.is_superuser():
            queryset = queryset.filter(
                team__organizationmember__user=request.user,
            )

        query = request.GET.get('query')
        if query:
            tokens = tokenize_query(query)
            for key, value in six.iteritems(tokens):
                if key == 'query':
                    value = ' '.join(value)
                    queryset = queryset.filter(
                        Q(name__icontains=value) |
                        Q(slug__icontains=value)
                    )
                elif key == 'slug':
                    queryset = queryset.filter(
                        in_iexact('slug', value)
                    )
                elif key == 'name':
                    queryset = queryset.filter(
                        in_iexact('name', value)
                    )
                elif key == 'platform':
                    queryset = queryset.filter(
                        id__in=ProjectPlatform.objects.filter(
                            platform__in=value,
                        ).values('project_id')
                    )
                elif key == 'id':
                    queryset = queryset.filter(id__in=value)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-date_added',
            on_results=lambda x: serialize(x, request.user, ProjectWithOrganizationSerializer()),
            paginator_cls=DateTimePaginator,
        )
