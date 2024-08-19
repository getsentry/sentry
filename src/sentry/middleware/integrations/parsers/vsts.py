from __future__ import annotations

import logging

import orjson
import sentry_sdk
from django.http.response import HttpResponseBase

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.vsts.webhooks import WorkItemWebhook, get_vsts_external_id
from sentry.silo.base import control_silo_function

logger = logging.getLogger(__name__)


class VstsRequestParser(BaseRequestParser):
    provider = "vsts"
    webhook_identifier = WebhookProviderIdentifier.VSTS

    region_view_classes = [WorkItemWebhook]

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        try:
            data = orjson.loads(self.request.body)
            external_id = get_vsts_external_id(data=data)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return None
        return Integration.objects.filter(external_id=external_id, provider=self.provider).first()

    def get_response(self) -> HttpResponseBase:
        if self.view_class not in self.region_view_classes:
            return self.get_response_from_control_silo()

        try:
            integration = self.get_integration_from_request()
            if not integration:
                return self.get_default_missing_integration_response()

            regions = self.get_regions_from_organizations()
        except (Integration.DoesNotExist, OrganizationIntegration.DoesNotExist):
            return self.get_default_missing_integration_response()

        return self.get_response_from_webhookpayload(
            regions=regions, identifier=integration.id, integration_id=integration.id
        )
