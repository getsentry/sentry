from __future__ import absolute_import

from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import SentryApp


class OrganizationSentryAppsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        queryset = SentryApp.objects.filter(
            owner=organization,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-date_added',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
