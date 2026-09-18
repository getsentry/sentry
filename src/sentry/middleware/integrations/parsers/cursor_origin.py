from __future__ import annotations

from django.http.response import HttpResponseBase

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser


class CursorOriginRequestParser(BaseRequestParser):
    """Origin only delivers installation events, which control silo owns."""

    provider = "cursor_origin"
    webhook_identifier = WebhookProviderIdentifier.CURSOR_ORIGIN

    def get_response(self) -> HttpResponseBase:
        shed_response = self.get_shed_response()
        if shed_response is not None:
            return shed_response

        return self.get_response_from_control_silo()
