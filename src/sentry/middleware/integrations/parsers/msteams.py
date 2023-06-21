from __future__ import annotations

import logging

from django.http import HttpResponse
from django.urls import resolve

from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders

logger = logging.getLogger(__name__)


class MsTeamsRequestParser(BaseRequestParser):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.MSTEAMS]
    webhook_identifier = WebhookProviderIdentifier.MSTEAMS

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        request = self.request
        data = request.data  # type:ignore
        integration = None
        try:
            payload = data["value"]["payload"]
            integration_id = payload["integrationId"]
            integration = Integration.objects.filter(id=integration_id).first()
        except Exception:
            pass

        if integration:
            return integration

        try:
            channel_data = data["channelData"]
            team_id = channel_data["team"]["id"]
            integration = Integration.objects.filter(
                provider=self.provider, external_id=team_id
            ).first()
        except Exception:
            pass
        return integration

    def get_response(self) -> HttpResponse:
        result = resolve(self.request.path)
        if result.url_name != "sentry-integration-msteams-webhooks":
            return self.get_response_from_control_silo()

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.error("no_regions", extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        return self.get_response_from_outbox_creation(regions=regions)
