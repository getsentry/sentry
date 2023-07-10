from __future__ import annotations

import logging
from typing import Any, Mapping, MutableMapping, Sequence

from django import forms
from django.contrib import messages
from django.http import HttpResponse
from django.utils.translation import gettext_lazy as _
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.pipeline import Pipeline, PipelineView
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response

from .client import OpsgenieProxySetupClient

logger = logging.getLogger("sentry.integrations.opsgenie")

DESCRIPTION = """
Trigger alerts in Opsgenie from Sentry.

Opsgenie is a cloud-based service for dev & ops teams, providing reliable alerts, on-call schedule management and escalations.
Opsgenie integrates with monitoring tools & services and ensures that the right people are notified via email, SMS, phone calls,
and iOS & Android push notifications.
"""


FEATURES = [
    FeatureDescription(
        """
        Manage incidents and outages by sending Sentry notifications to Opsgenie.
        """,
        IntegrationFeatures.INCIDENT_MANAGEMENT,
    ),
    FeatureDescription(
        """
        Configure rule based Opsgenie alerts that automatically trigger and notify specific teams.
        """,
        IntegrationFeatures.ALERT_RULE,
    ),
]

metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/opsgenie",
    aspects={},
)


class OpsgenieFinishedView(PipelineView):
    def dispatch(self, request: Request, pipeline: Pipeline) -> Response:
        response = pipeline.finish_pipeline()

        integration = getattr(pipeline, "integration", None)
        if not integration:
            return response

        messages.add_message(request, messages.SUCCESS, "Opsgenie integration installed.")

        return self.redirect(
            absolute_uri(
                f"/settings/{pipeline.organization.slug}/integrations/opsgenie/{integration.id}/"
            )
        )


class InstallationForm(forms.Form):
    base_url = forms.CharField(
        label=_("Base URL"),
        help_text=_("Either https://api.opsgenie.com/ or https://api.eu.opsgenie.com/"),
        widget=forms.TextInput(attrs={"placeholder": "https://api.opsgenie.com/"}),
    )
    api_key = forms.CharField(
        label=("Opsgenie API Key"),
        widget=forms.TextInput(
            attrs={
                "placeholder": _("5832fc6e14300a0d962240a8144466eef4ee93ef0d218477e55f11cf12fc3737")
            }
        ),
    )


class InstallationConfigView(PipelineView):
    def dispatch(self, request: Request, pipeline) -> HttpResponse:
        if "goback" in request.GET:
            pipeline.state.step_index = 0
            return pipeline.current_step()
        if request.method == "POST":
            form = InstallationForm(request.POST)
            if form.is_valid():
                form_data = form.cleaned_data

                pipeline.bind_state("installation_data", form_data)

                return pipeline.next_step()
        else:
            form = InstallationForm()

        return render_to_response(
            template="sentry/integrations/opsgenie-config.html",
            context={"form": form},
            request=request,
        )


class InstallationGuideView(PipelineView):
    def dispatch(self, request: Request, pipeline) -> HttpResponse:
        if "completed_installation_guide" in request.GET:
            return pipeline.next_step()
        return render_to_response(
            template="sentry/integrations/opsgenie-config.html",
            context={
                "next_url": f'{absolute_uri("/extensions/opsgenie/setup/")}?completed_installation_guide',
                "setup_values": [
                    {"label": "Name", "value": "Sentry"},
                    {
                        "label": "Access rights",
                        "value": "Read, Create and update, Delete, Configuration access",
                    },
                ],
            },
            request=request,
        )


class OpsgenieIntegration(IntegrationInstallation):
    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        """
        "config": [
            {"team_name": team 1, "integration_key": team 1 API key, "id": team 1 ID},
            {"team_name": team 2, "integration_key": team 2 API key, "id": team 2 ID}.
            ...
        ]
        """
        return super().update_organization_config(data)


class OpsgenieIntegrationProvider(IntegrationProvider):
    key = "opsgenie"
    name = "Opsgenie (Integration)"
    metadata = metadata
    integration_cls = OpsgenieIntegration
    features = frozenset([IntegrationFeatures.INCIDENT_MANAGEMENT, IntegrationFeatures.ALERT_RULE])
    # requires_feature_flag = True  # limited release

    def get_account_info(self, base_url, api_key):
        client = OpsgenieProxySetupClient(base_url=base_url, api_key=api_key)
        try:
            resp = client.get_account()
            return resp.json
        except ApiError as e:
            logger.info(
                "opsgenie.installation.get-account-info-failure",
                extra={
                    "base_url": base_url,
                    "error_message": str(e),
                    "error_status": e.code,
                },
            )
            raise IntegrationError("The requested Opsgenie account could not be found.")

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        return [InstallationGuideView(), InstallationConfigView(), OpsgenieFinishedView()]

    def build_integration(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        """
        "metadata": {
            "api_key": org-level API key
            "base_url": should be https://api.opsgenie.com/ or https://api.eu.opsgenie.com/
        }
        """
        api_key = state["installation_data"]["api_key"]
        base_url = state["installation_data"]["base_url"]

        account = self.get_account_info(base_url=base_url, api_key=api_key).get("data")

        return {
            "name": account.get("name"),
            "external_id": account.get("name"),
            "metadata": {"api_key": api_key, "base_url": base_url},
        }
