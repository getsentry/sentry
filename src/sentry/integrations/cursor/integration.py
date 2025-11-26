from __future__ import annotations

import uuid
from collections.abc import Mapping, MutableMapping
from typing import Any, Literal

from django import forms
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.translation import gettext_lazy as _
from pydantic import BaseModel, ValidationError
from requests import HTTPError

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
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.apitoken import generate_token
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


class CursorAgentConfigForm(forms.Form):
    api_key = forms.CharField(
        label=_("Cursor API Key"),
        help_text=_("Enter your Cursor API key to call Cursor Agents with."),
        widget=forms.PasswordInput(attrs={"placeholder": _("***********************")}),
        max_length=255,
    )


class CursorPipelineView:
    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
        if request.method == "POST":
            form = CursorAgentConfigForm(request.POST)
            if form.is_valid():
                pipeline.bind_state("config", form.cleaned_data)
                return pipeline.next_step()
        else:
            form = CursorAgentConfigForm()

        from sentry.web.helpers import render_to_response

        return render_to_response(
            template="sentry/integrations/cursor-config.html",
            context={"form": form},
            request=request,
        )


class CursorAgentIntegrationProvider(CodingAgentIntegrationProvider):
    key = "cursor"
    name = "Cursor Agent"
    can_add = True
    metadata = metadata
    setup_dialog_config = {"width": 600, "height": 700}
    requires_feature_flag = True

    features = frozenset(
        [
            IntegrationFeatures.CODING_AGENT,
        ]
    )

    def get_pipeline_views(self):
        return [CursorPipelineView()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        config = state.get("config", {})
        if not config:
            raise IntegrationConfigurationError("Missing configuration data")

        webhook_secret = generate_token()
        api_key = config["api_key"]

        api_key_name = None
        user_email = None
        try:
            client = CursorAgentClient(api_key=api_key, webhook_secret=webhook_secret)
            cursor_metadata = client.get_api_key_metadata()
            api_key_name = cursor_metadata.apiKeyName
            user_email = cursor_metadata.userEmail
        except (HTTPError, ApiError):
            self.get_logger().exception(
                "cursor.build_integration.metadata_fetch_failed",
            )
        except ValidationError:
            self.get_logger().exception(
                "cursor.build_integration.metadata_validation_failed",
            )

        integration_name = (
            f"Cursor Cloud Agent - {user_email}/{api_key_name}"
            if user_email and api_key_name
            else "Cursor Cloud Agent"
        )

        metadata = CursorIntegrationMetadata(
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
            "metadata": metadata.dict(),
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
        metadata.api_key = api_key
        integration_service.update_integration(
            integration_id=self.model.id, metadata=metadata.dict()
        )
        self.model.metadata = metadata.dict()

        # Do not store API key in org config; clear any submitted value
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
