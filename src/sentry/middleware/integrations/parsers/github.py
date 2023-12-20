from __future__ import annotations

import logging
from typing import Any, Mapping

from django.http import HttpResponse

from sentry.integrations.github.webhook import (
    GitHubIntegrationsWebhookEndpoint,
    get_github_external_id,
)
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
    webhook_endpoint: Any = GitHubIntegrationsWebhookEndpoint
    """Overridden in GithubEnterpriseRequestParser"""

    def _get_external_id(self, event: Mapping[str, Any]) -> str | None:
        """Overridden in GithubEnterpriseRequestParser"""
        return get_github_external_id(event)

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        if not self.is_json_request():
            return None
        try:
            event = json.loads(self.request.body.decode(encoding="utf-8"))
        except json.JSONDecodeError:
            return None
        external_id = self._get_external_id(event=event)
        if not external_id:
            return None
        return Integration.objects.filter(external_id=external_id, provider=self.provider).first()

    def get_response(self):
        if self.view_class != self.webhook_endpoint:
            return self.get_response_from_control_silo()

        try:
            event = json.loads(self.request.body.decode(encoding="utf-8"))
        except json.JSONDecodeError:
            return HttpResponse(status=400)

        if event.get("installation") and event.get("action") in {"created", "deleted"}:
            return self.get_response_from_control_silo()

        regions = self.get_regions_from_organizations()
        if len(regions) == 0:
            logger.info("%s.no_regions", self.provider, extra={"path": self.request.path})
            return self.get_response_from_control_silo()
        return self.get_response_from_outbox_creation(regions=regions)
