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

    control_events = ["installation"]

    def get_event(self):
        try:
            event = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return None
        return event

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        try:
            self.event = json.loads(self.request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return None
        external_id = self.event.get("installation", {}).get("id")
        return Integration.objects.filter(external_id=external_id, provider=self.provider).first()

    def get_response(self):
        event_type = self.request.META.get("HTTP_X_GITHUB_EVENT")

        if event_type in self.control_events:
            return self.get_response_from_control_silo()

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.error("no_regions", extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        return self.get_response_from_outbox_creation(regions=regions)
