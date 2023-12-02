from __future__ import annotations

import logging
from functools import cached_property

import sentry_sdk
from django.http.response import HttpResponseBase

from sentry.integrations.msteams.webhook import MsTeamsWebhookEndpoint, MsTeamsWebhookMixin
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.types.region import RegionResolutionError
from sentry.utils import json

logger = logging.getLogger(__name__)


class MsTeamsRequestParser(BaseRequestParser, MsTeamsWebhookMixin):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.MSTEAMS]
    webhook_identifier = WebhookProviderIdentifier.MSTEAMS

    region_view_classes = [MsTeamsWebhookEndpoint]

    @cached_property
    def request_data(self):
        data = {}
        try:
            data = json.loads(self.request.body.decode(encoding="utf-8"))
        except Exception as err:
            sentry_sdk.capture_exception(err)
        return data

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        integration = self.get_integration_from_card_action(data=self.request_data)
        if integration is None:
            integration = self.get_integration_from_channel_data(data=self.request_data)
        if integration:
            return Integration.objects.filter(id=integration.id).first()
        return None

    def get_response(self) -> HttpResponseBase:
        if self.view_class not in self.region_view_classes:
            return self.get_response_from_control_silo()

        if not self.can_infer_integration(data=self.request_data):
            return self.get_response_from_control_silo()

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.info("%s.no_regions", self.provider, extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        return self.get_response_from_outbox_creation(regions=regions)
