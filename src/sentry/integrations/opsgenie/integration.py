from __future__ import annotations

import logging
from typing import Any, Mapping, MutableMapping, Sequence

from django import forms
from django.http import HttpResponse
from django.utils.translation import gettext_lazy as _
from rest_framework.request import Request
from rest_framework.serializers import ValidationError

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.pipeline import PipelineView
from sentry.services.hybrid_cloud.organization import RpcOrganizationSummary
from sentry.tasks.integrations import migrate_opsgenie_plugin
from sentry.web.helpers import render_to_response

from .client import OpsgenieClient
from .utils import get_team

logger = logging.getLogger("sentry.integrations.opsgenie")

DESCRIPTION = """
Trigger alerts in Opsgenie from Sentry.

Opsgenie is a cloud-based service for dev and ops teams, providing reliable alerts, on-call schedule management, and escalations.
Opsgenie integrates with monitoring tools and services to ensure that the right people are notified via email, SMS, phone, and iOS/Android push notifications.
"""


FEATURES = [
    FeatureDescription(
        """
        Manage incidents and outages by sending Sentry notifications to Opsgenie.
        """,
        IntegrationFeatures.ENTERPRISE_INCIDENT_MANAGEMENT,
    ),
    FeatureDescription(
        """
        Configure rule based Opsgenie alerts that automatically trigger and notify specific teams.
        """,
        IntegrationFeatures.ENTERPRISE_ALERT_RULE,
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

OPSGENIE_BASE_URL_TO_DOMAIN_NAME = {
    "https://api.opsgenie.com/": "app.opsgenie.com",
    "https://api.eu.opsgenie.com/": "app.eu.opsgenie.com",
}


class InstallationForm(forms.Form):
    base_url = forms.ChoiceField(
        label=_("Base URL"),
        choices=[
            ("https://api.opsgenie.com/", "api.opsgenie.com"),
            ("https://api.eu.opsgenie.com/", "api.eu.opsgenie.com"),
        ],
    )
    provider = forms.CharField(
        label=_("Account Name"),
        help_text=_("Example: 'acme' for https://acme.app.opsgenie.com/"),
        widget=forms.TextInput(),
    )

    api_key = forms.CharField(
        label=("Opsgenie Integration Key"),
        help_text=_(
            "Optionally, add your first integration key for sending alerts. You can rename this key later."
        ),
        widget=forms.TextInput(),
        required=False,
    )


class InstallationConfigView(PipelineView):
    def dispatch(self, request: Request, pipeline) -> HttpResponse:  # type:ignore
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


class OpsgenieIntegration(IntegrationInstallation):
    def get_keyring_client(self, keyid: str) -> OpsgenieClient:
        org_integration = self.org_integration
        assert org_integration, "OrganizationIntegration is required"
        team = get_team(keyid, org_integration)
        assert team, "Cannot get client for unknown team"

        return OpsgenieClient(
            integration=self.model,
            integration_key=team["integration_key"],
            org_integration_id=org_integration.id,
            keyid=keyid,
        )

    def get_client(self) -> Any:  # type: ignore
        raise NotImplementedError("Use get_keyring_client instead.")

    def get_organization_config(self) -> Sequence[Any]:
        fields = [
            {
                "name": "team_table",
                "type": "table",
                "label": "Opsgenie integrations",
                "help": "Your keys have to be associated with a Sentry integration in Opsgenie. You can update, delete, or add them here. You’ll need to update alert rules individually for any added or deleted keys.",
                "addButtonText": "",
                "columnLabels": {
                    "team": "Label",
                    "integration_key": "Integration Key",
                },
                "columnKeys": ["team", "integration_key"],
                "confirmDeleteMessage": "Any alert rules associated with this integration will stop working. The rules will still exist but will show a `removed` team.",
            }
        ]

        return fields

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        # add the integration ID to a newly added row
        if not self.org_integration:
            return

        teams = data["team_table"]
        unsaved_teams = [team for team in teams if team["id"] == ""]
        # this is not instantaneous, so you could add the same team a bunch of times in a row
        # but I don't anticipate this being too much of an issue
        added_names = {team["team"] for team in teams if team not in unsaved_teams}
        for team in unsaved_teams:
            if team["team"] in added_names:
                raise ValidationError({"duplicate_name": ["Duplicate team name."]})
            team["id"] = str(self.org_integration.id) + "-" + team["team"]
        return super().update_organization_config(data)

    def schedule_migrate_opsgenie_plugin(self):
        migrate_opsgenie_plugin.apply_async(
            kwargs={
                "integration_id": self.model.id,
                "organization_id": self.organization_id,
            }
        )


class OpsgenieIntegrationProvider(IntegrationProvider):
    key = "opsgenie"
    name = "Opsgenie"
    metadata = metadata
    integration_cls = OpsgenieIntegration
    features = frozenset([IntegrationFeatures.INCIDENT_MANAGEMENT, IntegrationFeatures.ALERT_RULE])

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        return [InstallationConfigView()]

    def build_integration(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        api_key = state["installation_data"]["api_key"]
        base_url = state["installation_data"]["base_url"]
        name = state["installation_data"]["provider"]
        return {
            "name": name,
            "external_id": name,
            "metadata": {
                "api_key": api_key,
                "base_url": base_url,
                "domain_name": f"{name}.{OPSGENIE_BASE_URL_TO_DOMAIN_NAME[base_url]}",
            },
        }

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganizationSummary,
        extra: Any | None = None,
    ) -> None:
        try:
            org_integration = OrganizationIntegration.objects.get(
                integration=integration, organization_id=organization.id
            )

        except OrganizationIntegration.DoesNotExist:
            logger.exception("The Opsgenie post_install step failed.")
            return

        key = integration.metadata["api_key"]
        team_table = []
        if key:
            team_name = "my-first-key"
            team_id = f"{org_integration.id}-{team_name}"
            team_table.append({"team": team_name, "id": team_id, "integration_key": key})

        org_integration.config.update({"team_table": team_table})
        org_integration.update(config=org_integration.config)
