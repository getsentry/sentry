from __future__ import annotations

import logging

import sentry_sdk
from django.http.response import HttpResponseBase

from sentry.integrations.vsts.webhooks import WorkItemWebhook, get_vsts_external_id
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.utils import json

logger = logging.getLogger(__name__)


class VstsRequestParser(BaseRequestParser):
    provider = "vsts"
    webhook_identifier = WebhookProviderIdentifier.VSTS

    region_view_classes = [WorkItemWebhook]

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        try:
            data = json.loads(self.request.body.decode(encoding="utf-8"))
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

        return self.get_response_from_webhookpayload_for_integration(
            regions=regions, integration=integration
        )
