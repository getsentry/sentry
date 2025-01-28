from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import orjson
from django.http.response import HttpResponseBase

from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.gitlab.webhooks import GitlabWebhookEndpoint, get_gitlab_external_id
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.types import EXTERNAL_PROVIDERS, ExternalProviders
from sentry.integrations.utils.scope import clear_tags_and_context
from sentry.silo.base import control_silo_function
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class GitlabRequestParser(BaseRequestParser):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.GITLAB]
    webhook_identifier = WebhookProviderIdentifier.GITLAB
    _integration: Integration | None = None
    _METRIC_CONTROL_PATH_FAILURE_KEY = "integrations.gitlab.get_integration_from_request.failure"

    def _resolve_external_id(self) -> tuple[str, str] | HttpResponseBase:
        clear_tags_and_context()
        extra = {
            # This tells us the Gitlab version being used (e.g. current gitlab.com version -> GitLab/15.4.0-pre)
            "user-agent": self.request.META.get("HTTP_USER_AGENT"),
            # Gitlab does not seem to be the only host sending events
            # AppPlatformEvents also hit this API
            "event-type": self.request.META.get("HTTP_X_GITLAB_EVENT"),
        }
        return get_gitlab_external_id(request=self.request, extra=extra)

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        if self._integration:
            return self._integration
        if not self.is_json_request():
            return None
        try:
            # Webhook endpoints
            result = self._resolve_external_id()
            if isinstance(result, tuple):
                (external_id, _secret) = result
                self._integration = Integration.objects.filter(
                    external_id=external_id, provider=self.provider
                ).first()
                return self._integration
        except Exception as e:
            metrics.incr(
                self._METRIC_CONTROL_PATH_FAILURE_KEY,
                tags={"integration": self.provider, "error": str(e)},
            )
            logger.exception("Failed to get integration from request")

        return None

    def get_response_from_gitlab_webhook(self):
        maybe_http_response = self._resolve_external_id()
        if isinstance(maybe_http_response, HttpResponseBase):
            return maybe_http_response

        try:
            integration = self.get_integration_from_request()
            if not integration:
                return self.get_default_missing_integration_response()

            regions = self.get_regions_from_organizations()
        except (Integration.DoesNotExist, OrganizationIntegration.DoesNotExist):
            return self.get_default_missing_integration_response()

        try:
            data = orjson.loads(self.request.body)
        except orjson.JSONDecodeError:
            data = {}

        return self.get_response_from_webhookpayload(
            regions=regions,
            identifier=self.get_mailbox_identifier(integration, data),
            integration_id=integration.id,
        )

    def mailbox_bucket_id(self, data: Mapping[str, Any]) -> int | None:
        """
        Used by get_mailbox_identifier to find the project.id a payload is for.
        In high volume gitlab instances we shard messages by project for greater
        delivery throughput.
        """
        project_id = data.get("project", {}).get("id", None)
        if not project_id:
            return None
        return project_id

    def get_response(self) -> HttpResponseBase:
        if self.view_class == GitlabWebhookEndpoint:
            return self.get_response_from_gitlab_webhook()
        return self.get_response_from_control_silo()
