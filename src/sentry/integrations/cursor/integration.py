from __future__ import annotations

from collections.abc import Mapping
from typing import Any

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
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.apitoken import generate_token
from sentry.shared_integrations.exceptions import IntegrationError

DESCRIPTION = """
Connect your Sentry organization to Cursor Agent.
"""

FEATURES = [
    FeatureDescription(
        """
        Launch Background Cursor Agents via the Seer UI to fix a issue's Root Cause Analysis or automatically via Seer Automation (Configure in Seer Settings).
        """,
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
        help_text=_("Enter your Cursor API key to call background Cursor Agents with."),
        widget=forms.TextInput(),
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

        # Render the configuration form
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

        # Generate webhook secret for this integration
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
        """Get the API key from integration metadata."""
        return self.metadata["api_key"]
