from __future__ import annotations

import logging
from typing import cast

from django.http import HttpResponse
from rest_framework.request import Request

from sentry.integrations.vsts.webhooks import VstsWebhookMixin, WorkItemWebhook
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.services.hybrid_cloud.util import control_silo_function

logger = logging.getLogger(__name__)


class VstsRequestParser(BaseRequestParser, VstsWebhookMixin):
    provider = "vsts"
    webhook_identifier = WebhookProviderIdentifier.VSTS

    region_view_classes = [WorkItemWebhook]

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        try:
            external_id = self.get_external_id(request=cast(Request, self.request))
        except Exception:
            return None
        return Integration.objects.filter(external_id=external_id, provider=self.provider).first()

    def get_response(self) -> HttpResponse:
        if self.view_class not in self.region_view_classes:
            return self.get_response_from_control_silo()

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.error(f"{self.provider}.no_regions", extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        return self.get_response_from_outbox_creation(regions=regions)
