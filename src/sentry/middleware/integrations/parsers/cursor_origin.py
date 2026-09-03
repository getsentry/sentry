from __future__ import annotations

import logging

from django.http.response import HttpResponse, HttpResponseBase

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import IntegrationProviderSlug

logger = logging.getLogger(__name__)

# Origin puts the installation on a header, so the integration can be resolved
# without parsing the body.
INSTALLATION_ID_HEADER = "webhook-installation-id"
EVENT_TYPE_HEADER = "webhook-event-type"

# Events whose handling only touches the control-silo Integration row. Everything
# else may write region data (commits, pull requests) and has to reach a cell.
CONTROL_ONLY_EVENT_PREFIX = "installation."


class CursorOriginRequestParser(BaseRequestParser):
    """Routes Cursor Origin webhooks to the silo that can act on them.

    Installation lifecycle disables the control-silo ``Integration`` row, so it is
    answered in control. Everything else -- push events creating commits, and
    later pull request activity -- writes region data and is forwarded to the
    organizations' cells.

    The parser also has to exist for the mundane reason that without one,
    ``IntegrationClassification`` reports every ``/extensions/cursor-origin/``
    request as an unknown provider.
    """

    provider = IntegrationProviderSlug.CURSOR_ORIGIN.value
    webhook_identifier = WebhookProviderIdentifier.CURSOR_ORIGIN

    def get_integration_from_request(self) -> Integration | None:
        installation_id = self.request.headers.get(INSTALLATION_ID_HEADER)
        if not installation_id:
            return None
        return Integration.objects.filter(
            external_id=installation_id, provider=self.provider
        ).first()

    def get_response(self) -> HttpResponseBase:
        event_type = self.request.headers.get(EVENT_TYPE_HEADER) or ""

        if event_type.startswith(CONTROL_ONLY_EVENT_PREFIX):
            return self.get_response_from_control_silo()

        integration = self.get_integration_from_request()
        if not integration:
            # A delivery for an installation we do not know about. Answering
            # rather than erroring keeps Origin from retrying forever, and from
            # disabling the endpoint over deliveries we could never handle.
            logger.info(
                "cursor_origin.parser.unknown_installation",
                extra={"event_type": event_type},
            )
            return HttpResponse(status=202)

        cells = self.get_cells_from_organizations()
        if len(cells) == 0:
            return self.get_default_missing_integration_response()

        return self.get_response_from_webhookpayload(
            cells=cells,
            identifier=integration.id,
            integration_id=integration.id,
        )
