from __future__ import absolute_import

from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize, OrganizationActivitySerializer
from sentry.models import Activity


class OrganizationActivityEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        queryset = Activity.objects.filter(
            project__organization=organization,
        ).select_related('project', 'user')

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=DateTimePaginator,
            order_by='-datetime',
            on_results=lambda x: serialize(
                x, request.user, OrganizationActivitySerializer()
            ),
        )
