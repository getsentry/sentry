from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from django import forms
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.translation import gettext_lazy as _
from rest_framework.serializers import ValidationError

from sentry.constants import ObjectStatus
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.on_call.metrics import OnCallIntegrationsHaltReason, OnCallInteractionType
from sentry.integrations.opsgenie.metrics import record_event
from sentry.integrations.opsgenie.tasks import migrate_opsgenie_plugin
from sentry.organizations.services.organization import RpcOrganizationSummary
from sentry.pipeline import Pipeline, PipelineView
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiRateLimitedError,
    ApiUnauthorized,
    IntegrationError,
)
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
    def dispatch(self, request: HttpRequest, pipeline: Pipeline) -> HttpResponseBase:
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
    def get_keyring_client(self, keyid: int | str) -> OpsgenieClient:
        org_integration = self.org_integration
        assert org_integration, "OrganizationIntegration is required"
        team = get_team(team_id=keyid, org_integration=org_integration)
        assert team, "Cannot get client for unknown team"

        return OpsgenieClient(
            integration=self.model,
            integration_key=team["integration_key"],
        )

    def get_client(self) -> Any:  # type: ignore[explicit-override]
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
        from sentry.integrations.services.integration import integration_service

        # add the integration ID to a newly added row
        if not self.org_integration:
            return

        teams = data["team_table"]
        unsaved_teams = [team for team in teams if team["id"] == ""]
        # this is not instantaneous, so you could add the same team a bunch of times in a row
        # but I don't anticipate this being too much of an issue
        added_names = {team["team"] for team in teams if team not in unsaved_teams}
        existing_team_key_pairs = {
            (team["team"], team["integration_key"]) for team in teams if team not in unsaved_teams
        }

        integration = integration_service.get_integration(
            organization_integration_id=self.org_integration.id, status=ObjectStatus.ACTIVE
        )
        if not integration:
            raise IntegrationError("Integration does not exist")

        for team in unsaved_teams:
            if team["team"] in added_names:
                raise ValidationError({"duplicate_name": ["Duplicate team name."]})
            team["id"] = str(self.org_integration.id) + "-" + team["team"]

        invalid_keys = []
        with record_event(OnCallInteractionType.VERIFY_KEYS).capture() as lifecycle:
            for team in teams:
                # skip if team, key pair already exist in config
                if (team["team"], team["integration_key"]) in existing_team_key_pairs:
                    continue

                integration_key = team["integration_key"]

                # validate integration keys
                client = OpsgenieClient(
                    integration=integration,
                    integration_key=integration_key,
                )
                # call an API to test the integration key
                try:
                    client.get_alerts()
                except ApiError as e:
                    if e.code == 429:
                        raise ApiRateLimitedError(
                            "Too many requests. Please try updating one team/key at a time."
                        )
                    elif e.code == 401:
                        invalid_keys.append(integration_key)
                        pass
                    elif e.json and e.json.get("message"):
                        raise ApiError(e.json["message"])
                    else:
                        raise

            if invalid_keys:
                lifecycle.record_halt(
                    OnCallIntegrationsHaltReason.INVALID_KEY,
                    extra={"invalid_keys": invalid_keys, "integration_id": integration.id},
                )
                raise ApiUnauthorized(f"Invalid integration key: {str(invalid_keys)}")

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

    def get_pipeline_views(self) -> list[PipelineView]:
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
        with record_event(OnCallInteractionType.POST_INSTALL).capture():
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
