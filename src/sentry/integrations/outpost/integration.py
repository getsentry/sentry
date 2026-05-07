from __future__ import annotations

import uuid
from collections.abc import Mapping, MutableMapping
from typing import Any

from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from pydantic import BaseModel
from rest_framework.fields import CharField, URLField

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
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
from sentry.integrations.models.integration import Integration
from sentry.integrations.outpost.client import OutpostAgentClient
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.apitoken import generate_token
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.shared_integrations.exceptions import IntegrationConfigurationError

DESCRIPTION = "Connect your Sentry organization with an Outpost (OpenTower) agent."

FEATURES = [
    FeatureDescription(
        "Launch Outpost coding agents via Seer to fix issues.",
        IntegrationFeatures.CODING_AGENT,
    ),
]


class OutpostIntegrationMetadata(BaseModel):
    base_url: str
    webhook_secret: str


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Agent"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Outpost%20Agent%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/outpost",
    aspects={},
)


class OutpostConfigSerializer(CamelSnakeSerializer):
    base_url = URLField(required=True, max_length=512)


class OutpostConfigApiStep:
    step_name = "outpost_config"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {}

    def get_serializer_cls(self) -> type:
        return OutpostConfigSerializer

    def handle_post(
        self,
        validated_data: dict[str, str],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        pipeline.bind_state("config", {"base_url": validated_data["base_url"]})
        return PipelineStepResult.advance()


class OutpostAgentIntegrationProvider(CodingAgentIntegrationProvider):
    key = "outpost"
    name = "Outpost Agent"
    metadata = metadata
    requires_feature_flag = True

    def get_pipeline_views(self):
        return []

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [OutpostConfigApiStep()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        config = state.get("config", {})
        if not config:
            raise IntegrationConfigurationError("Missing configuration data")

        base_url = config["base_url"].rstrip("/")
        webhook_secret = generate_token()

        int_metadata = OutpostIntegrationMetadata(
            base_url=base_url,
            webhook_secret=webhook_secret,
        )

        return {
            "external_id": uuid.uuid4().hex,
            "name": f"Outpost Agent ({base_url})",
            "metadata": int_metadata.dict(),
        }

    def get_agent_name(self) -> str:
        return "Outpost Agent"

    def get_agent_key(self) -> str:
        return "outpost"

    @classmethod
    def get_installation(
        cls, model: RpcIntegration | Integration, organization_id: int, **kwargs: Any
    ) -> OutpostAgentIntegration:
        return OutpostAgentIntegration(model, organization_id)


class OutpostAgentIntegration(CodingAgentIntegration):
    def get_organization_config(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "base_url",
                "type": "text",
                "label": _("Outpost Base URL"),
                "help": _("The base URL of your Outpost (OpenTower) instance."),
                "required": True,
                "placeholder": "https://outpost.example.com",
            }
        ]

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        base_url = data.get("base_url")
        if not base_url:
            raise IntegrationConfigurationError("Base URL is required")

        int_metadata = OutpostIntegrationMetadata.parse_obj(self.model.metadata or {})
        int_metadata.base_url = base_url.rstrip("/")
        self._persist_metadata(int_metadata)
        super().update_organization_config({})

    def get_client(self):
        return OutpostAgentClient(
            base_url=self.base_url,
            webhook_secret=self.webhook_secret,
        )

    @property
    def webhook_secret(self) -> str:
        return OutpostIntegrationMetadata.parse_obj(self.model.metadata).webhook_secret

    @property
    def base_url(self) -> str:
        return OutpostIntegrationMetadata.parse_obj(self.model.metadata).base_url
