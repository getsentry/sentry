from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import SentryAppBaseEndpoint, SentryAppStatsPermission
from sentry.api.utils import get_date_range_from_params, InvalidParams

from sentry.utils.sentryappwebhookrequests import SentryAppWebhookRequestsBuffer


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

        # TODO actually use the start/end params?

        buffer = SentryAppWebhookRequestsBuffer(sentry_app)
        # TODO for now I'm just getting all requests for all events
        requests = buffer.get_requests()

        return Response(requests)
