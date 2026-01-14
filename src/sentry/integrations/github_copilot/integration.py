from __future__ import annotations

import uuid
from collections.abc import Mapping
from typing import Any

from django.utils.translation import gettext_lazy as _

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationMetadata,
)
from sentry.integrations.coding_agent.integration import (
    CodingAgentIntegration,
    CodingAgentIntegrationProvider,
)
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.github_copilot.client import GithubCopilotAgentClient
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.seer.autofix.utils import CodingAgentState

DESCRIPTION = "Connect your Sentry organization with GitHub Copilot coding agent."

FEATURES = [
    FeatureDescription(
        "Launch GitHub Copilot coding agent via Seer to fix issues.",
        IntegrationFeatures.CODING_AGENT,
    ),
]


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Agent"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=GitHub%20Copilot%20Agent%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github_copilot",
    aspects={},
)


class GithubCopilotAgentIntegrationProvider(CodingAgentIntegrationProvider):
    key = "github_copilot"
    name = "GitHub Copilot"
    can_add = False
    metadata = metadata
    setup_dialog_config = {"width": 600, "height": 700}
    requires_feature_flag = True

    features = frozenset(
        [
            IntegrationFeatures.CODING_AGENT,
        ]
    )

    def get_pipeline_views(self):
        return []

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        return {
            "external_id": uuid.uuid4().hex,
            "name": "GitHub Copilot Agent",
            "metadata": {},
        }

    def get_agent_name(self) -> str:
        return "GitHub Copilot"

    def get_agent_key(self) -> str:
        return "github_copilot"

    @classmethod
    def get_installation(
        cls, model: RpcIntegration | Integration, organization_id: int, **kwargs: Any
    ) -> GithubCopilotAgentIntegration:
        return GithubCopilotAgentIntegration(model, organization_id)


class GithubCopilotAgentIntegration(CodingAgentIntegration):

    def __init__(
        self,
        model: RpcIntegration | Integration | None,
        organization_id: int,
    ) -> None:
        self.model = model  # type: ignore[assignment]
        self.organization_id = organization_id

    def get_client(self) -> GithubCopilotAgentClient:
        raise NotImplementedError(
            "GithubCopilotAgentIntegration uses per-user tokens. "
            "Use get_client_for_user() or launch_with_user_token() instead."
        )

    def get_client_for_user(self, user_access_token: str) -> GithubCopilotAgentClient:
        return GithubCopilotAgentClient(user_access_token=user_access_token)

    def launch_with_user_token(
        self, request: CodingAgentLaunchRequest, user_access_token: str
    ) -> CodingAgentState:
        client = self.get_client_for_user(user_access_token)
        return client.launch(webhook_url="", request=request)
