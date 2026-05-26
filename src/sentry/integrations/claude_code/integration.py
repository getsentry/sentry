"""
Claude Code Agent Integration Provider.

Registers the Claude Code integration so it appears in get_coding_agent_providers()
and can be used by the coding agent system.
"""

from __future__ import annotations

import hashlib
import logging
from collections.abc import Mapping, MutableMapping
from typing import Any, Literal

from django.conf import settings as django_settings
from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from pydantic import BaseModel, validator
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
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps
from sentry.seer.autofix.utils import CodingAgentState
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.utils.imports import import_string

logger = logging.getLogger(__name__)

PROVIDER_KEY = "claude_code"
PROVIDER_NAME = "Claude Agent"
DESCRIPTION = "Connect your Sentry organization with Claude Agent."
DEFAULT_ENVIRONMENT_NAME = "sentry-autofix-agents"


def _get_client_class() -> type[Any]:
    """Load the Claude Code client class from the CLAUDE_CODE_CLIENT_CLASS setting.

    Returns the concrete client class (e.g. getsentry's ClaudeCodeClient).
    Typed as Any because the concrete class lives outside this repo.
    """

    class_path = django_settings.CLAUDE_CODE_CLIENT_CLASS
    if not class_path:
        raise IntegrationConfigurationError(
            "CLAUDE_CODE_CLIENT_CLASS is not configured. "
            "The Claude Code client is not available in this environment."
        )
    return import_string(class_path)


FEATURES = [
    FeatureDescription(
        "Launch Claude Agent sessions via Seer to fix issues.",
        IntegrationFeatures.CODING_AGENT,
    ),
]


class ClaudeCodeIntegrationMetadata(BaseModel):
    """Metadata stored with the integration."""

    api_key: str
    domain_name: Literal["anthropic.com"] = "anthropic.com"
    environment_id: str | None = None
    workspace_name: str | None = "default"
    agent_id: str | None = None
    agent_version: int | None = None
    model: str | None = None

    @validator("agent_version", pre=True)
    def coerce_agent_version(cls, v: object) -> int | None:
        # Old SDK stored version as a timestamp string — drop it so the agent is recreated.
        # New versions come from the API as integers, so any string value is stale.
        if isinstance(v, str):
            return None
        return v  # type: ignore[return-value]


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="Sentry",
    noun=_("Agent"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Claude%20Code%20Agent%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/claude_code",
    aspects={},
)


def _build_environment_choices(
    environment_choices: list[tuple[str, str]] | None,
) -> list[tuple[str, str]]:
    """Build the environment dropdown choices, handling the default environment specially.

    If an environment named ``sentry-autofix-agents`` exists, the default
    option reads "Use Default Environment - 'sentry-autofix-agents'" and the
    environment is removed from the individual choices. Otherwise the default
    option reads "Create a Default Sentry Environment".
    """
    has_default = False
    filtered: list[tuple[str, str]] = []
    if environment_choices:
        for env_id, env_name in environment_choices:
            if env_name == DEFAULT_ENVIRONMENT_NAME:
                has_default = True
            else:
                filtered.append((env_id, env_name))

    if has_default:
        default_label = str(_("Use Default Environment - '%s'") % DEFAULT_ENVIRONMENT_NAME)
    else:
        default_label = str(_("Create a Default Sentry Environment"))

    return [("", default_label)] + filtered


def _build_external_id(organization_id: int) -> str:
    digest = hashlib.sha256(f"{PROVIDER_KEY}:{organization_id}".encode()).hexdigest()
    return digest[:32]


def _delete_legacy_integrations(organization_id: int, external_id: str) -> None:
    # Per-instance .delete() generates the cross-silo outboxes that bulk delete skips.
    legacy_integration_ids = list(
        OrganizationIntegration.objects.filter(
            organization_id=organization_id,
            integration__provider=PROVIDER_KEY,
        )
        .exclude(integration__external_id=external_id)
        .values_list("integration_id", flat=True)
    )
    for integration in Integration.objects.filter(id__in=legacy_integration_ids):
        integration.delete()


class ClaudeCodeApiKeySerializer(CamelSnakeSerializer):
    api_key = CharField(required=True, max_length=255)


class ClaudeCodeApiKeyApiStep:
    step_name = "api_key_config"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {}

    def get_serializer_cls(self) -> type:
        return ClaudeCodeApiKeySerializer

    def handle_post(
        self,
        validated_data: dict[str, str],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        pipeline.bind_state("api_key", validated_data["api_key"])
        return PipelineStepResult.advance()


class ClaudeCodeAgentIntegrationProvider(CodingAgentIntegrationProvider):
    """
    Integration provider for Claude Code Agent.

    This registers the integration so it appears in get_coding_agent_providers()
    and can be used by the coding agent system (Seer autofix).
    """

    key = PROVIDER_KEY
    name = PROVIDER_NAME
    metadata = metadata

    def get_pipeline_views(self):
        return []

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [ClaudeCodeApiKeyApiStep()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        api_key = state.get("api_key")
        if not api_key:
            raise IntegrationConfigurationError("Missing API key")

        # Validate the API key
        try:
            client_class = _get_client_class()
            client = client_class(api_key=api_key)
            is_valid = client.validate_api_key()
            if not is_valid:
                raise IntegrationConfigurationError(
                    "Invalid Anthropic API key. Please check your credentials."
                )
        except IntegrationConfigurationError:
            raise
        except ValueError as e:
            # e.g. valid key but GET /v1/models lists no model we support (getsentry client).
            self.get_logger().warning(
                "claude_code.build_integration.no_supported_model",
                extra={"error": str(e)},
            )
            raise IntegrationConfigurationError(str(e)) from e
        except Exception as e:
            self.get_logger().exception(
                "claude_code.build_integration.validation_failed",
            )
            raise IntegrationConfigurationError("Unable to validate Anthropic API key.") from e

        environment_id = None
        workspace_name = "default"

        integration_metadata = ClaudeCodeIntegrationMetadata(
            domain_name="anthropic.com",
            api_key=api_key,
            environment_id=environment_id,
            workspace_name=workspace_name,
            model=getattr(client, "model", None),
        )

        assert self.pipeline.organization is not None
        organization_id = self.pipeline.organization.id
        external_id = _build_external_id(organization_id)
        _delete_legacy_integrations(organization_id, external_id)

        return {
            "external_id": external_id,
            "name": PROVIDER_NAME,
            "metadata": integration_metadata.dict(),
        }

    def get_agent_name(self) -> str:
        return PROVIDER_NAME

    def get_agent_key(self) -> str:
        return PROVIDER_KEY

    @classmethod
    def get_installation(
        cls, model: RpcIntegration | Integration, organization_id: int, **kwargs: Any
    ) -> ClaudeCodeAgentIntegration:
        return ClaudeCodeAgentIntegration(model, organization_id)


class ClaudeCodeAgentIntegration(CodingAgentIntegration):
    """
    Integration installation for Claude Code Agent.

    Manages the API key and environment ID for interacting with Claude Code.
    """

    def get_organization_config(self) -> list[dict[str, Any]]:
        client = self.get_client()
        environment_choices: list[tuple[str, str]] = []
        try:
            environments = client.list_environments()
            environment_choices = [
                (env["id"], env.get("name") or env["id"]) for env in environments if env.get("id")
            ]
        except Exception:
            logger.exception("claude_code.get_organization_config.fetch_environments_failed")
        choices = _build_environment_choices(environment_choices)

        return [
            {
                "name": "environment_id",
                "type": "select",
                "label": _("Environment"),
                "help": _(
                    "Select an existing environment, or leave as default "
                    "to use the sentry-autofix-agents environment."
                ),
                "required": False,
                "choices": choices,
            },
            {
                "name": "workspace_is_default",
                "type": "boolean",
                "label": _("I am using the default workspace"),
                "help": _(
                    "Check this if your Anthropic workspace is named 'default'. "
                    "When checked, an 'Open in Claude' link to the session is shown. "
                    "Uncheck if you use a custom workspace name — the link will be hidden."
                ),
                "required": False,
            },
        ]

    def _get_metadata(self) -> ClaudeCodeIntegrationMetadata:
        """Parse and return the integration metadata."""
        return ClaudeCodeIntegrationMetadata.parse_obj(self.model.metadata or {})

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        metadata = self._get_metadata()

        if "environment_id" in data:
            metadata.environment_id = data["environment_id"] or None

        if "workspace_is_default" in data:
            metadata.workspace_name = "default" if data["workspace_is_default"] else None

        self._persist_metadata(metadata)
        super().update_organization_config({})

    def get_config_data(self) -> Mapping[str, Any]:
        metadata = self._get_metadata()
        return {
            "environment_id": metadata.environment_id or "",
            "workspace_is_default": metadata.workspace_name == "default",
        }

    def get_client(self) -> Any:
        metadata = self._get_metadata()
        client_class = _get_client_class()
        return client_class(
            api_key=metadata.api_key,
            environment_id=metadata.environment_id,
            workspace_name=metadata.workspace_name,
            agent_id=metadata.agent_id,
            agent_version=metadata.agent_version,
            model=metadata.model,
        )

    def launch(self, request: CodingAgentLaunchRequest) -> CodingAgentState:
        """Launch coding agent and persist resolved environment/agent IDs."""
        webhook_url = self.get_webhook_url()
        client = self.get_client()

        state = client.launch(webhook_url=webhook_url, request=request)
        state.integration_id = self.model.id

        metadata = self._get_metadata()
        metadata_changed = False

        if client.environment_id and client.environment_id != metadata.environment_id:
            metadata.environment_id = client.environment_id
            metadata_changed = True

        if client.agent_id and client.agent_id != metadata.agent_id:
            metadata.agent_id = client.agent_id
            metadata.agent_version = client.agent_version
            metadata_changed = True

        if metadata_changed:
            self._persist_metadata(metadata)

        return state

    @property
    def api_key(self) -> str:
        return self._get_metadata().api_key
