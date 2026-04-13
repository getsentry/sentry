from __future__ import annotations

import uuid
from collections.abc import Mapping
from typing import Any

from django.utils.translation import gettext_lazy as _

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
)
from sentry.integrations.coding_agent.integration import CodingAgentIntegrationProvider

DESCRIPTION = """
Allow users in your Sentry organization to send issues to GitHub Copilot agents.
Each user authenticates with their own GitHub account — no org-wide credentials are required.
"""

FEATURES = [
    FeatureDescription(
        "Allow users to send Seer root cause analysis to GitHub Copilot agents.",
        IntegrationFeatures.CODING_AGENT,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Integration"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=GitHub%20Copilot%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github_copilot",
    aspects={"directEnable": True},
)


class GithubCopilotIntegration(IntegrationInstallation):
    """
    Minimal installation — GitHub Copilot uses per-user OAuth tokens,
    not org-wide credentials, so there is nothing to configure here.
    """

    def get_client(self) -> None:
        raise NotImplementedError("GitHub Copilot uses per-user OAuth, not an org-level client")


class GithubCopilotIntegrationProvider(CodingAgentIntegrationProvider):
    key = "github_copilot"
    name = "GitHub Copilot"
    metadata = metadata
    integration_cls = GithubCopilotIntegration
    feature_flag_name = "organizations:integrations-github-copilot-agent"

    def get_agent_name(self) -> str:
        return "GitHub Copilot"

    def get_agent_key(self) -> str:
        return "github_copilot"

    def get_pipeline_views(self) -> list[Any]:
        return []

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        return {
            "name": "GitHub Copilot",
            "external_id": str(uuid.uuid4()),
            "metadata": {},
        }
