"""
Claude Code Agent Integration Provider.

Registers the Claude Code integration so it appears in get_coding_agent_providers()
and can be used by the coding agent system.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Mapping, MutableMapping
from typing import Any, Literal

from django import forms
from django.conf import settings as django_settings
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.translation import gettext_lazy as _
from pydantic import BaseModel

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationMetadata,
)
from sentry.integrations.coding_agent.integration import (
    CodingAgentIntegration,
    CodingAgentIntegrationProvider,
    CodingAgentPipelineView,
)
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.integrations.models.integration import Integration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.seer.autofix.utils import CodingAgentState
from sentry.shared_integrations.exceptions import IntegrationConfigurationError
from sentry.utils.imports import import_string

logger = logging.getLogger(__name__)

PROVIDER_KEY = "claude_code"
PROVIDER_NAME = "Claude Agent"
DESCRIPTION = "Connect your Sentry organization with Claude Agent."


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
    workspace_name: str | None = None


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="Sentry",
    noun=_("Agent"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Claude%20Code%20Agent%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/claude_code",
    aspects={},
)


class ClaudeCodeApiKeyForm(forms.Form):
    """Step 1: Collect the Anthropic API key."""

    api_key = forms.CharField(
        label=_("Anthropic API Key"),
        help_text=_("Enter your Anthropic API key to use Claude Agent."),
        widget=forms.PasswordInput(attrs={"placeholder": _("sk-ant-...")}),
        max_length=255,
    )


class ClaudeCodeEnvironmentForm(forms.Form):
    """Step 2: Select an environment and optionally provide a workspace name."""

    environment_id = forms.ChoiceField(
        label=_("Environment"),
        help_text=_(
            "Select an existing environment, or leave as "
            '"Create new automatically" to create one on first use.'
        ),
        required=False,
    )
    workspace_name = forms.CharField(
        label=_("Workspace Name (optional)"),
        help_text=_(
            "Your Anthropic workspace name (from platform.claude.com URL). "
            "Used to link to session details."
        ),
        widget=forms.TextInput(attrs={"placeholder": _("my-workspace")}),
        max_length=255,
        required=False,
    )

    def __init__(
        self, *args: Any, environment_choices: list[tuple[str, str]] | None = None, **kwargs: Any
    ) -> None:
        super().__init__(*args, **kwargs)
        choices: list[tuple[str, str]] = [("", str(_("Create new automatically")))]
        if environment_choices:
            choices += environment_choices
        env_field = self.fields["environment_id"]
        assert isinstance(env_field, forms.ChoiceField)
        env_field.choices = choices


class ClaudeCodeApiKeyPipelineView(CodingAgentPipelineView):
    """Pipeline step 1: Collect API key."""

    def get_form_class(self) -> type[forms.Form]:
        return ClaudeCodeApiKeyForm

    def get_template_name(self) -> str:
        return "sentry/integrations/claude-code-config.html"

    def get_state_key(self) -> str:
        return "api_key"

    def bind_state(self, pipeline: IntegrationPipeline, form: forms.Form) -> None:
        pipeline.bind_state(self.get_state_key(), form.cleaned_data["api_key"])


class ClaudeCodeEnvironmentPipelineView(CodingAgentPipelineView):
    """Pipeline step 2: Select environment and workspace name."""

    def get_form_class(self) -> type[forms.Form]:
        return ClaudeCodeEnvironmentForm

    def get_template_name(self) -> str:
        return "sentry/integrations/claude-code-environment.html"

    def get_state_key(self) -> str:
        return "environment"

    def _fetch_environment_choices(self, api_key: str) -> list[tuple[str, str]]:
        """Fetch environments from the Anthropic API and return as form choices."""
        client_class = _get_client_class()
        client = client_class(api_key=api_key)
        environments = client.list_environments()
        return [(env["id"], env.get("name") or env["id"]) for env in environments if env.get("id")]

    def get_form_kwargs(
        self, request: HttpRequest, pipeline: IntegrationPipeline
    ) -> dict[str, Any]:
        api_key: str | None = pipeline.fetch_state("api_key")
        if not api_key:
            return {"environment_choices": []}
        try:
            environment_choices = self._fetch_environment_choices(api_key)
        except Exception:
            logger.exception("claude_code.fetch_environments_failed")
            environment_choices = []
        return {"environment_choices": environment_choices}

    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
        api_key = pipeline.fetch_state("api_key")
        if not api_key:
            pipeline.state.step_index = 0
            return pipeline.current_step()
        return super().dispatch(request, pipeline)


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
        return [ClaudeCodeApiKeyPipelineView(), ClaudeCodeEnvironmentPipelineView()]

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
        except Exception as e:
            if isinstance(e, IntegrationConfigurationError):
                raise
            self.get_logger().exception(
                "claude_code.build_integration.validation_failed",
            )
            raise IntegrationConfigurationError(
                "Unable to validate Anthropic API key. Please check your credentials."
            ) from e

        environment_config = state.get("environment", {})
        environment_id = environment_config.get("environment_id") or None
        workspace_name = environment_config.get("workspace_name") or None

        integration_metadata = ClaudeCodeIntegrationMetadata(
            domain_name="anthropic.com",
            api_key=api_key,
            environment_id=environment_id,
            workspace_name=workspace_name,
        )

        return {
            "external_id": uuid.uuid4().hex,
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
        choices: list[tuple[str, str]] = [("", str(_("Create new automatically")))]
        client = self.get_client()
        environments = []
        try:
            environments = client.list_environments()
        except Exception:
            logger.exception("claude_code.get_organization_config.fetch_environments_failed")

        choices.extend(
            (env["id"], env.get("name") or env["id"]) for env in environments if env.get("id")
        )

        return [
            {
                "name": "environment_id",
                "type": "select",
                "label": _("Environment"),
                "help": _(
                    "Select an existing environment, or leave as "
                    '"Create new automatically" to create one on first use.'
                ),
                "required": False,
                "choices": choices,
            },
            {
                "name": "workspace_name",
                "type": "text",
                "label": _("Workspace Name (optional)"),
                "help": _(
                    "Your Anthropic workspace name (from platform.claude.com URL). "
                    "Used to link to session details."
                ),
                "required": False,
                "placeholder": "my-workspace",
                "formatMessageValue": False,
            },
        ]

    def _get_metadata(self) -> ClaudeCodeIntegrationMetadata:
        """Parse and return the integration metadata."""
        return ClaudeCodeIntegrationMetadata.parse_obj(self.model.metadata or {})

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        metadata = self._get_metadata()

        if "environment_id" in data:
            metadata.environment_id = data["environment_id"] or None

        if "workspace_name" in data:
            metadata.workspace_name = data["workspace_name"] or None

        self._persist_metadata(metadata)
        super().update_organization_config({})

    def get_config_data(self) -> Mapping[str, Any]:
        metadata = self._get_metadata()
        return {
            "environment_id": metadata.environment_id or "",
            "workspace_name": metadata.workspace_name or "",
        }

    def get_client(self) -> Any:
        metadata = self._get_metadata()
        client_class = _get_client_class()
        return client_class(
            api_key=metadata.api_key,
            environment_id=metadata.environment_id,
            workspace_name=metadata.workspace_name,
        )

    def launch(self, request: CodingAgentLaunchRequest) -> CodingAgentState:
        """Launch coding agent and persist the resolved environment ID."""
        webhook_url = self.get_webhook_url()
        client = self.get_client()

        state = client.launch(webhook_url=webhook_url, request=request)
        state.integration_id = self.model.id

        if client.environment_id and client.environment_id != self.environment_id:
            self.update_environment_id(client.environment_id)

        return state

    @property
    def api_key(self) -> str:
        return self._get_metadata().api_key

    @property
    def environment_id(self) -> str | None:
        return self._get_metadata().environment_id

    def update_environment_id(self, environment_id: str) -> None:
        """Update the stored environment ID for this integration."""
        metadata = self._get_metadata()
        metadata.environment_id = environment_id
        self._persist_metadata(metadata)
