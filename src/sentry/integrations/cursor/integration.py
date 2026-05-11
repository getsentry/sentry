from __future__ import annotations

import uuid
from collections.abc import Mapping, MutableMapping
from typing import Any, Literal

from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from pydantic import BaseModel
from requests import HTTPError
from rest_framework.fields import CharField

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
from sentry.integrations.cursor.client import CursorAgentClient
from sentry.integrations.models.integration import Integration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.apitoken import generate_token
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.shared_integrations.exceptions import ApiError, IntegrationConfigurationError

DESCRIPTION = "Connect your Sentry organization with Cursor Cloud Agents."

FEATURES = [
    FeatureDescription(
        "Launch Cursor Cloud Agents via Seer to fix issues.",
        IntegrationFeatures.CODING_AGENT,
    ),
]


class CursorIntegrationMetadata(BaseModel):
    api_key: str
    webhook_secret: str
    domain_name: Literal["cursor.sh"] = "cursor.sh"
    api_key_name: str | None = None
    user_email: str | None = None


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Agent"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Cursor%20Agent%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/cursor",
    aspects={},
)


class CursorApiKeySerializer(CamelSnakeSerializer):
    api_key = CharField(required=True, max_length=255)


class CursorApiKeyApiStep:
    step_name = "api_key_config"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {}

    def get_serializer_cls(self) -> type:
        return CursorApiKeySerializer

    def handle_post(
        self,
        validated_data: dict[str, str],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        pipeline.bind_state("config", {"api_key": validated_data["api_key"]})
        return PipelineStepResult.advance()


class CursorAgentIntegrationProvider(CodingAgentIntegrationProvider):
    key = "cursor"
    name = "Cursor Agent"
    metadata = metadata
    # The organizations:integrations-cursor flag has graduated; skip the
    # parent class's flag check rather than rely on a removed registration.
    requires_feature_flag = False

    def get_pipeline_views(self):
        return []

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [CursorApiKeyApiStep()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        config = state.get("config", {})
        if not config:
            raise IntegrationConfigurationError("Missing configuration data")

        webhook_secret = generate_token()
        api_key = config["api_key"]

        try:
            client = CursorAgentClient(api_key=api_key, webhook_secret=webhook_secret)
            cursor_metadata = client.verify_api_key()
            api_key_name = cursor_metadata.apiKeyName if cursor_metadata else None
            user_email = cursor_metadata.userEmail if cursor_metadata else None
        except (HTTPError, ApiError) as e:
            self.get_logger().exception("cursor.build_integration.api_key_verification_failed")
            status_code: int | None = None
            if isinstance(e, ApiError):
                status_code = e.code
            elif isinstance(e, HTTPError) and e.response is not None:
                status_code = e.response.status_code
            if status_code in (401, 403):
                raise IntegrationConfigurationError(
                    "Invalid Cursor API key. Please verify that your API key is correct and has not been revoked."
                )
            raise IntegrationConfigurationError(
                "Unable to validate Cursor API key. Please try again or contact support if the issue persists."
            )

        if user_email and api_key_name:
            integration_name = f"Cursor Cloud Agent - {user_email}/{api_key_name}"
        else:
            key_hint = api_key[:8] if len(api_key) >= 8 else api_key
            integration_name = f"Cursor Cloud Agent ({key_hint}...)"

        int_metadata = CursorIntegrationMetadata(
            domain_name="cursor.sh",
            api_key=api_key,
            webhook_secret=webhook_secret,
            api_key_name=api_key_name,
            user_email=user_email,
        )

        return {
            # NOTE(jennmueng): We need to create a unique ID for each integration installation. Because of this, new installations will yield a unique external_id and integration.
            # Why UUIDs? We use UUIDs here for each integration installation because we don't know how many times this USER-LEVEL API key will be used, or if the same org can have multiple cursor agents (in the near future)
            # or if the same user can have multiple installations across multiple orgs. So just a UUID per installation is the best approach. Re-configuring an existing installation will still maintain this external id
            "external_id": uuid.uuid4().hex,
            "name": integration_name,
            "metadata": int_metadata.dict(),
        }

    def get_agent_name(self) -> str:
        return "Cursor Agent"

    def get_agent_key(self) -> str:
        return "cursor"

    @classmethod
    def get_installation(
        cls, model: RpcIntegration | Integration, organization_id: int, **kwargs: Any
    ) -> CursorAgentIntegration:
        return CursorAgentIntegration(model, organization_id)


class CursorAgentIntegration(CodingAgentIntegration):
    def get_organization_config(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "api_key",
                "type": "secret",
                "label": _("Cursor API Key"),
                "help": _("Update the API key used by Cursor Cloud Agents."),
                "required": True,
                "placeholder": "***********************",
                "formatMessageValue": False,
            }
        ]

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        api_key = data.get("api_key")
        if not api_key:
            raise IntegrationConfigurationError("API key is required")

        metadata = CursorIntegrationMetadata.parse_obj(self.model.metadata or {})

        try:
            client = CursorAgentClient(api_key=api_key, webhook_secret=metadata.webhook_secret)
            cursor_metadata = client.verify_api_key()
            metadata.api_key = api_key
            metadata.api_key_name = cursor_metadata.apiKeyName if cursor_metadata else None
            metadata.user_email = cursor_metadata.userEmail if cursor_metadata else None
        except (HTTPError, ApiError) as e:
            status_code: int | None = None
            if isinstance(e, ApiError):
                status_code = e.code
            elif isinstance(e, HTTPError) and e.response is not None:
                status_code = e.response.status_code
            if status_code in (401, 403):
                raise IntegrationConfigurationError(
                    "Invalid Cursor API key. Please verify that your API key is correct and has not been revoked."
                )
            raise IntegrationConfigurationError(
                "Unable to validate Cursor API key. Please try again or contact support if the issue persists."
            )

        if metadata.user_email and metadata.api_key_name:
            integration_name = f"Cursor Cloud Agent - {metadata.user_email}/{metadata.api_key_name}"
        else:
            key_hint = api_key[:8] if len(api_key) >= 8 else api_key
            integration_name = f"Cursor Cloud Agent ({key_hint}...)"

        self._persist_metadata(metadata, name=integration_name)
        super().update_organization_config({})

    def get_client(self):
        return CursorAgentClient(
            api_key=self.api_key,
            webhook_secret=self.webhook_secret,
        )

    def get_dynamic_display_information(self) -> Mapping[str, Any] | None:
        """Return metadata to display in the configurations list."""
        metadata = CursorIntegrationMetadata.parse_obj(self.model.metadata or {})

        display_info = {}
        if metadata.api_key_name:
            display_info["api_key_name"] = metadata.api_key_name
        if metadata.user_email:
            display_info["user_email"] = metadata.user_email

        return display_info if display_info else None

    @property
    def webhook_secret(self) -> str:
        return CursorIntegrationMetadata.parse_obj(self.model.metadata).webhook_secret

    @property
    def api_key(self) -> str:
        return CursorIntegrationMetadata.parse_obj(self.model.metadata).api_key
