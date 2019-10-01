from __future__ import absolute_import

# from rest_framework.response import Response

from sentry.api.bases import SentryAppBaseEndpoint, SentryAppStatsPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.models import SentryAppWebhookError


class SentryAppErrorsEndpoint(SentryAppBaseEndpoint):
    permission_classes = (SentryAppStatsPermission,)

    def get(self, request, sentry_app):
        """
        :qparam float start
        :qparam float end
        """
        start, end = get_date_range_from_params(request.GET, optional=True)

        queryset = SentryAppWebhookError.objects.filter(sentry_app=sentry_app.id)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
