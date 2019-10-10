from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import SentryAppBaseEndpoint, SentryAppStatsPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params, InvalidParams
from sentry.models import SentryAppWebhookError


class SentryAppErrorsEndpoint(SentryAppBaseEndpoint):
    permission_classes = (SentryAppStatsPermission,)

    def get(self, request, sentry_app):
        """
        :qparam float start - optional
        :qparam float end - optional
        """
        try:
            start, end = get_date_range_from_params(request.GET, optional=True)
        except InvalidParams as exc:
            return Response({"detail": exc.message}, status=400)

        filter_args = {"sentry_app": sentry_app.id}
        if start is not None and end is not None:
            filter_args["date_added__range"] = (start, end)

        queryset = SentryAppWebhookError.objects.filter(**filter_args)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
