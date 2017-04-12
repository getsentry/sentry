from __future__ import absolute_import
# from rest_framework.response import Response

# from django.db.models import Q

from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize, OrganizationActivitySerializer

from sentry.models import Activity


class OrganizationUserActivityEndpoint(OrganizationEndpoint):

    def get(self, request, organization, user_id):

        queryset = Activity.objects.filter(
            user=user_id,
        ).select_related('project', 'group', 'user')

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=DateTimePaginator,
            order_by='-datetime',
            on_results=lambda x: serialize(
                x, request.user, OrganizationActivitySerializer()
            ),
        )
