from __future__ import annotations

import logging

import sentry_sdk
from django.http.response import HttpResponseBase

from sentry.integrations.msteams.webhook import MsTeamsWebhookEndpoint, MsTeamsWebhookMixin
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders

logger = logging.getLogger(__name__)


class MsTeamsRequestParser(BaseRequestParser, MsTeamsWebhookMixin):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.MSTEAMS]
    webhook_identifier = WebhookProviderIdentifier.MSTEAMS

    region_view_classes = [MsTeamsWebhookEndpoint]

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        integration = self.get_integration_from_card_action(self.request)
        if integration is None:
            integration = self.get_integration_from_channel_data(self.request)
        if integration:
            return Integration.objects.filter(id=integration.id).first()
        return None

    def get_response(self) -> HttpResponseBase:
        with sentry_sdk.push_scope() as scope:
            scope.set_extra("path", self.request.path)
            scope.set_extra("request_method", self.request.method)
            sentry_sdk.capture_message(
                f"{self.provider}.request_parser.get_response",
            )

        if self.view_class not in self.region_view_classes:
            return self.get_response_from_control_silo()

        if not self.can_infer_integration(self.request):
            return self.get_response_from_control_silo()

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.info(f"{self.provider}.no_regions", extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        return self.get_response_from_outbox_creation(regions=regions)
