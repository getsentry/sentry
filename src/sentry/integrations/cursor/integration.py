from __future__ import annotations

from collections.abc import Mapping, MutableMapping
from typing import int, Any

from django import forms
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
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
from sentry.integrations.cursor.client import CursorAgentClient
from sentry.integrations.models.integration import Integration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.apitoken import generate_token
from sentry.shared_integrations.exceptions import IntegrationError

DESCRIPTION = "Connect your Sentry organization with Cursor Cloud Agents."

FEATURES = [
    FeatureDescription(
        "Launch Cursor Cloud Agents via Seer to fix issues.",
        IntegrationFeatures.CODING_AGENT,
    ),
]

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
            raise IntegrationError("Missing configuration data")

        webhook_secret = generate_token()

        return {
            "external_id": "cursor",
            "name": "Cursor Agent",
            "metadata": {
                "api_key": config["api_key"],
                "domain_name": "cursor.sh",
                "webhook_secret": webhook_secret,
            },
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
            raise IntegrationError("API key is required")

        # Persist on the Integration metadata since this key is global per installation
        metadata = dict(self.model.metadata or {})
        metadata["api_key"] = api_key
        integration_service.update_integration(integration_id=self.model.id, metadata=metadata)

        # Do not store API key in org config; clear any submitted value
        super().update_organization_config({})

    def get_client(self):
        return CursorAgentClient(
            api_key=self.api_key,
            webhook_secret=self.webhook_secret,
        )

    @property
    def webhook_secret(self) -> str:
        return self.metadata["webhook_secret"]

    @property
    def api_key(self) -> str:
        return self.metadata["api_key"]
