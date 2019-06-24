from __future__ import absolute_import

import six

from django.db.models import Q

from sentry import features
from sentry.api.bases import NoProjects, OrganizationEventsError
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Build, BuildStatus
from sentry.search.utils import tokenize_query
from sentry.db.models.query import in_iexact


def map_value_to_constant(constant, value):
    value = value.upper()
    if not hasattr(constant, value):
        raise ValueError(value)
    return getattr(constant, value)


class OrganizationBuildsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        """
        Retrieve builds for an organization
        `````````````````````````````````````

        :pparam string organization_slug: the slug of the organization
        :auth: required
        """
        if not features.has('organizations:builds',
                            organization, actor=request.user):
            raise ResourceDoesNotExist

        try:
            filter_params = self.get_filter_params(
                request,
                organization,
                date_filter_optional=True,
            )
        except NoProjects:
            return self.respond([])
        except OrganizationEventsError as exc:
            return self.respond({'detail': exc.message}, status=400)

        queryset = Build.objects.filter(
            organization_id=organization.id,
            project_id__in=filter_params['project_id'],
        )
        query = request.GET.get('query')
        if query:
            tokens = tokenize_query(query)
            for key, value in six.iteritems(tokens):
                if key == 'query':
                    value = ' '.join(value)
                    queryset = queryset.filter(Q(name__icontains=value) | Q(build_id__iexact=value))
                elif key == 'id':
                    queryset = queryset.filter(in_iexact('build_id', value))
                elif key == 'name':
                    queryset = queryset.filter(in_iexact('name', value))
                elif key == 'status':
                    try:
                        queryset = queryset.filter(
                            status__in=map_value_to_constant(
                                BuildStatus, value))
                    except ValueError:
                        queryset = queryset.none()
                else:
                    queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-date_added',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
