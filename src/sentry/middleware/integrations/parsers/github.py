from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

import orjson
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase

import sentry.options as options
from sentry.hybridcloud.outbox.category import WebhookProviderIdentifier
from sentry.integrations.github.webhook import (
    GitHubIntegrationsWebhookEndpoint,
    get_github_external_id,
)
from sentry.integrations.github.webhook_types import GITHUB_WEBHOOK_TYPE_HEADER, GithubWebhookType
from sentry.integrations.middleware.hybrid_cloud.parser import BaseRequestParser
from sentry.integrations.models.integration import Integration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.overwatch_webhooks.webhook_forwarder import OverwatchGithubWebhookForwarder
from sentry.silo.base import control_silo_function
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class GithubRequestParser(BaseRequestParser):
    provider = IntegrationProviderSlug.GITHUB.value
    webhook_identifier = WebhookProviderIdentifier.GITHUB
    webhook_endpoint: Any = GitHubIntegrationsWebhookEndpoint
    """Overridden in GithubEnterpriseRequestParser"""

    def _get_external_id(self, event: Mapping[str, Any]) -> str | None:
        """Overridden in GithubEnterpriseRequestParser"""
        return get_github_external_id(event)

    def should_route_to_control_silo(
        self, parsed_event: Mapping[str, Any], request: HttpRequest
    ) -> bool:
        if options.get("github.webhook-type-routing.enabled"):
            return request.META.get(GITHUB_WEBHOOK_TYPE_HEADER) == GithubWebhookType.INSTALLATION

        return bool(
            parsed_event.get("installation")
            and not parsed_event.get("issue")
            and parsed_event.get("action") in {"created", "deleted"}
        )

    @control_silo_function
    def get_integration_from_request(self) -> Integration | None:
        if not self.is_json_request():
            return None
        try:
            event = orjson.loads(self.request.body)
        except orjson.JSONDecodeError:
            return None
        external_id = self._get_external_id(event=event)
        if not external_id:
            return None
        return Integration.objects.filter(external_id=external_id, provider=self.provider).first()

    def try_forward_to_codecov(self, event: Mapping[str, Any]) -> None:
        try:
            self.forward_to_codecov(external_id=self._get_external_id(event=event))
        except Exception:
            metrics.incr("codecov.forward-webhooks.forward-error", sample_rate=0.01)

    def get_response(self) -> HttpResponseBase:
        if self.view_class != self.webhook_endpoint:
            return self.get_response_from_control_silo()

        try:
            event = orjson.loads(self.request.body)
        except orjson.JSONDecodeError:
            return HttpResponse(status=400)

        if self.should_route_to_control_silo(parsed_event=event, request=self.request):
            self.try_forward_to_codecov(event=event)
            return self.get_response_from_control_silo()

        try:
            integration = self.get_integration_from_request()
            if not integration:
                return self.get_default_missing_integration_response()

            regions = self.get_regions_from_organizations()
        except Integration.DoesNotExist:
            return self.get_default_missing_integration_response()

        if len(regions) == 0:
            return self.get_default_missing_integration_response()

        if options.get("codecov.forward-webhooks.regions"):
            # if any of the regions are in the codecov.forward-webhooks.regions option, forward to codecov
            codecov_regions = list(
                {region.name for region in regions}
                & set(options.get("codecov.forward-webhooks.regions"))
            )
            if codecov_regions:
                self.try_forward_to_codecov(event=event)

        response = self.get_response_from_webhookpayload(
            regions=regions, identifier=integration.id, integration_id=integration.id
        )

        # The overwatch forwarder implements its own region-based checks
        OverwatchGithubWebhookForwarder(integration=integration).forward_if_applicable(
            event=event, headers=self.request.headers
        )

        return response
