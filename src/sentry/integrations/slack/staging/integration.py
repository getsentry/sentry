from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sentry.identity.pipeline import IdentityPipeline
from sentry.integrations.base import (
    IntegrationData,
)
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.slack.integration import SlackIntegrationProvider
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.views.base import PipelineView
from sentry.pipeline.views.nested import NestedPipelineView
from sentry.utils.http import absolute_uri

_logger = logging.getLogger("sentry.integrations.slack")


class SlackStagingIntegrationProvider(SlackIntegrationProvider):
    key = IntegrationProviderSlug.SLACK_STAGING.value
    name = "Slack (Staging)"
    requires_feature_flag = True

    def _get_oauth_scopes(self) -> frozenset[str]:
        return self.identity_oauth_scopes | self.extended_oauth_scopes

    def _identity_pipeline_view(self) -> PipelineView[IntegrationPipeline]:
        return NestedPipelineView(
            bind_key="identity",
            provider_key=IntegrationProviderSlug.SLACK_STAGING.value,
            pipeline_cls=IdentityPipeline,
            config={
                "oauth_scopes": self._get_oauth_scopes(),
                "user_scopes": self.user_scopes,
                "redirect_url": absolute_uri("/extensions/slack-staging/setup/"),
            },
        )

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        production_integration = super().build_integration(state=state)
        production_integration["user_identity"]["type"] = (
            IntegrationProviderSlug.SLACK_STAGING.value
        )
        return production_integration
