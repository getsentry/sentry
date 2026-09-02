from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import orjson
import sentry_sdk
from django.http.response import HttpResponseBase

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.vsts.webhooks import WorkItemWebhook, get_vsts_external_id
from sentry.silo.base import control_silo_function
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


class VstsRequestParser(BaseRequestParser):
    provider = IntegrationProviderSlug.AZURE_DEVOPS.value
    webhook_identifier = WebhookProviderIdentifier.VSTS

    # Far lower volume than GitHub: enough to unserialize a burst without thinning
    # mailboxes into scheduler rows that each carry a handful of payloads.
    mailbox_bucket_count = 10

    cell_view_classes = [WorkItemWebhook]

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
        if self.view_class not in self.cell_view_classes:
            return self.get_response_from_control_silo()

        try:
            integration = self.integration_for_request()
            if not integration:
                return self.get_default_missing_integration_response()

            cells = self.get_cells_from_organizations()
        except Integration.DoesNotExist:
            return self.get_default_missing_integration_response()

        if len(cells) == 0:
            return self.get_default_missing_integration_response()

        return self.get_response_from_webhookpayload(
            cells=cells,
            identifier=self.get_mailbox_identifier(integration, self.get_request_body()),
            integration_id=integration.id,
        )

    def mailbox_bucket_id(self, data: Mapping[str, Any]) -> int | None:
        """The subscription is created for `workitem.updated` only, so the work item
        is the only axis a VSTS mailbox can be split on.
        """
        try:
            return int(get_path(data, "resource", "workItemId"))
        except (TypeError, ValueError):
            return None
