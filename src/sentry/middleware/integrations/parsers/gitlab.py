from __future__ import annotations

import logging
from typing import Tuple

from django.http.response import HttpResponseBase
from django.urls import resolve

from sentry.integrations.gitlab.webhooks import GitlabWebhookEndpoint, GitlabWebhookMixin
from sentry.integrations.utils.scope import clear_tags_and_context
from sentry.middleware.integrations.parsers.base import BaseRequestParser
from sentry.models.integrations.integration import Integration
from sentry.models.outbox import WebhookProviderIdentifier
from sentry.services.hybrid_cloud.util import control_silo_function
from sentry.types.integrations import EXTERNAL_PROVIDERS, ExternalProviders

logger = logging.getLogger(__name__)


class GitlabRequestParser(BaseRequestParser, GitlabWebhookMixin):
    provider = EXTERNAL_PROVIDERS[ExternalProviders.GITLAB]
    webhook_identifier = WebhookProviderIdentifier.GITLAB
    _integration: Integration | None = None

    def _resolve_external_id(self) -> Tuple[str, str] | HttpResponseBase:
        clear_tags_and_context()
        extra = {
            # This tells us the Gitlab version being used (e.g. current gitlab.com version -> GitLab/15.4.0-pre)
            "user-agent": self.request.META.get("HTTP_USER_AGENT"),
            # Gitlab does not seem to be the only host sending events
            # AppPlatformEvents also hit this API
            "event-type": self.request.META.get("HTTP_X_GITLAB_EVENT"),
        }
        return super()._get_external_id(request=self.request, extra=extra)

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        if self._integration:
            return self._integration
        if not self.is_json_request():
            return None
        try:
            _view, _args, kwargs = resolve(self.request.path)
            # Non-webhook endpoints
            if "integration_id" in kwargs and "organization_slug" in kwargs:
                self._integration = Integration.objects.filter(
                    id=kwargs["integration_id"],
                    organization_slug=kwargs["organization_slug"],
                ).first()
                return self._integration

            # Webhook endpoints
            result = self._resolve_external_id()
            if isinstance(result, tuple):
                (external_id, _secret) = result
                self._integration = Integration.objects.filter(
                    external_id=external_id, provider=self.provider
                ).first()
                return self._integration
        except Exception:
            pass
        return None

    def get_response_from_gitlab_webhook(self):
        maybe_http_response = self._resolve_external_id()
        if isinstance(maybe_http_response, HttpResponseBase):
            return maybe_http_response

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.info("%s.no_regions", self.provider, extra={"path": self.request.path})
            return self.get_response_from_control_silo()

        return self.get_response_from_outbox_creation(regions=regions)

    def get_response(self) -> HttpResponseBase:
        if self.view_class == GitlabWebhookEndpoint:
            return self.get_response_from_gitlab_webhook()
        return self.get_response_from_control_silo()
