from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.types import IntegrationProviderSlug

logger = logging.getLogger(__name__)

DESCRIPTION = """
Automatically create/update incident retros in Notion via Sentry's incident management.
Keep your team's knowledge base connected and synchronized with Sentry.
"""

FEATURES = [
    FeatureDescription(
        """
        Automatically create and update incident retros in Notion via Sentry's incident management.
        """,
        IntegrationFeatures.INCIDENT_MANAGEMENT,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION,
    features=FEATURES,
    author="The Sentry Team",
    noun="Notion",
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Notion%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/notion",
    aspects={},
)


class NotionIntegration(IntegrationInstallation):
    def get_client(self) -> None: ...
    def get_organization_config(self) -> Sequence[Any]: ...
    def update_organization_config(self, data: Mapping[str, Any]) -> None: ...
    def get_config_data(self) -> Mapping[str, str]: ...


class NotionIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.NOTION.value
    name = "Notion"
    metadata = metadata
    integration_cls = NotionIntegration
