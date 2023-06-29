from __future__ import annotations

from typing import Any, Mapping, Sequence

from django.utils.translation import gettext_lazy as _

from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.pipeline.views.base import PipelineView

DESCRIPTION = "Discord’s your place to collaborate, share, and just talk about your day – or commiserate about app errors. Connect Sentry to your Discord server and get [alerts](https://docs.sentry.io/product/alerts/alert-types/) in a channel of your choice or via direct message when sh%t hits the fan."

FEATURES = [
    FeatureDescription(
        "Assign, ignore, and resolve issues by interacting with chat messages.",
        IntegrationFeatures.CHAT_UNFURL,
    ),
    # We'll add IntegrationFeatures.ALERT_RULE here in milestone 2
]

metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Discord%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/discord",
    aspects={},
)


class DiscordIntegration(IntegrationInstallation):
    pass


class DiscordIntegrationProvider(IntegrationProvider):
    key = "discord"
    name = "Discord"
    metadata = metadata
    integration_cls = DiscordIntegration
    features = frozenset([IntegrationFeatures.CHAT_UNFURL])
    requires_feature_flag = True  # remove this when we remove the discord feature flag

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        return super().get_pipeline_views()

    def build_integration(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        return super().build_integration(state)
