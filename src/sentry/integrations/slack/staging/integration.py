from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sentry.identity.slack.provider import SlackStagingIdentityProvider
from sentry.integrations.base import (
    IntegrationData,
)
from sentry.integrations.slack.integration import SlackIntegrationProvider
from sentry.integrations.types import IntegrationProviderSlug
from sentry.utils.http import absolute_uri

_logger = logging.getLogger("sentry.integrations.slack")


class SlackStagingIntegrationProvider(SlackIntegrationProvider):
    key = IntegrationProviderSlug.SLACK_STAGING.value
    name = "Slack (Staging)"
    requires_feature_flag = True
    setup_url_path = "/extensions/slack-staging/setup/"

    def _get_oauth_scopes(self) -> frozenset[str]:
        return self.identity_oauth_scopes | self.extended_oauth_scopes

    def _make_identity_provider(self) -> SlackStagingIdentityProvider:
        return SlackStagingIdentityProvider(
            oauth_scopes=self._get_oauth_scopes(),
            redirect_url=absolute_uri(self.setup_url_path),
        )

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        production_integration = super().build_integration(state=state)
        production_integration["user_identity"]["type"] = (
            IntegrationProviderSlug.SLACK_STAGING.value
        )
        return production_integration
