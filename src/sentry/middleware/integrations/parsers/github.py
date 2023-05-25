from __future__ import annotations

import logging

from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.utils import json

logger = logging.getLogger(__name__)


class GithubRequestParser(BaseRequestParser):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.GITHUB]
    webhook_identifier = WebhookProviderIdentifier.GITHUB

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        if not self.is_json_request():
            return None
        try:
            event = json.loads(self.request.body.decode(encoding="utf-8"))
        except json.JSONDecodeError:
            return None
        external_id = event.get("installation", {}).get("id")
        return Integration.objects.filter(external_id=external_id, provider=self.provider).first()

    def get_response(self):
        # All github webhooks will be sent to region silos
        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.error("no_regions", extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        return self.get_response_from_outbox_creation(regions=regions)
