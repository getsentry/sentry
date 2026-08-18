from __future__ import annotations

import logging

from django.http.response import HttpResponseBase

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.types import IntegrationProviderSlug

logger = logging.getLogger(__name__)


class CursorOriginRequestParser(BaseRequestParser):
    """Keeps Cursor Origin requests in the control silo.

    The only webhook handled today is ``installation.deleted``, which disables
    the control-silo ``Integration`` row and touches nothing region-bound, so
    there is nothing to forward. The parser still has to exist: without one,
    ``IntegrationClassification`` reports every ``/extensions/cursor-origin/``
    request as an unknown provider before falling through.

    Handlers that write region data -- commit tracking, PR comments -- will need
    this to resolve a cell and route through ``get_response_from_webhookpayload``
    rather than answering in control.
    """

    provider = IntegrationProviderSlug.CURSOR_ORIGIN.value
    webhook_identifier = WebhookProviderIdentifier.CURSOR_ORIGIN

    def get_response(self) -> HttpResponseBase:
        return self.get_response_from_control_silo()
