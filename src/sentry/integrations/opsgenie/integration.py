from __future__ import annotations

import logging
from typing import Any, Mapping, MutableMapping, Sequence

from django import forms
from django.forms.utils import ErrorList
from django.http import HttpResponse
from django.utils.translation import gettext_lazy as _
from requests.exceptions import MissingSchema
from rest_framework.request import Request
from rest_framework.serializers import ValidationError

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.pipeline import PipelineView
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response

from .client import OpsgenieClient, OpsgenieSetupClient

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


class InstallationForm(forms.Form):
    base_url = forms.ChoiceField(
        label=_("Base URL"),
        # help_text=_("Either https://api.opsgenie.com/ or https://api.eu.opsgenie.com/"),
        # widget=forms.TextInput(attrs={"placeholder": "https://api.opsgenie.com/"}),
        choices=[
            ("https://api.opsgenie.com/", "api.opsgenie.com"),
            ("https://api.eu.opsgenie.com/", "api.eu.opsgenie.com"),
        ],
    )
    api_key = forms.CharField(
        label=("Opsgenie API Key"),
        widget=forms.TextInput(),
    )


class TeamSelectForm(forms.Form):
    def __init__(
        self,
        team_list=None,
        data=None,
        files=None,
        auto_id="id_%s",
        prefix=None,
        initial=None,
        error_class=ErrorList,
        label_suffix=None,
        empty_permitted=False,
        field_order=None,
        use_required_attribute=None,
        renderer=None,
    ) -> None:
        super().__init__(
            data,
            files,
            auto_id,
            prefix,
            initial,
            error_class,
            label_suffix,
            empty_permitted,
            field_order,
            use_required_attribute,
            renderer,
        )

        self.fields["teams"] = forms.MultipleChoiceField(
            required=False,
            label=_("Select Teams"),
            help_text=_("Trigger and acknowledge alerts on these Opsgenie teams."),
            choices=team_list,
            widget=forms.CheckboxSelectMultiple(attrs={"placeholder": "Select..."}),
        )


class InstallationConfigView(PipelineView):
    def dispatch(self, request: Request, pipeline) -> HttpResponse:  # type:ignore
        if "goback" in request.GET:
            pipeline.state.step_index = 0
            return pipeline.current_step()
        if request.method == "POST":
            form_1 = InstallationForm(request.POST)
            if form_1.is_valid():
                form_data = form_1.cleaned_data

                pipeline.bind_state("installation_data", form_data)

                print("STEPPING")
                return pipeline.next_step()
        else:
            form_1 = InstallationForm()

        return render_to_response(
            template="sentry/integrations/opsgenie-config.html",
            context={
                "next_url": f'{absolute_uri("/extensions/opsgenie/setup/")}?selectteams',
                "form_1": form_1,
            },
            request=request,
        )


class InstallationGuideView(PipelineView):
    def dispatch(self, request: Request, pipeline) -> HttpResponse:  # type:ignore
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


class InstallationTeamSelectView(PipelineView):
    def dispatch(self, request: Request, pipeline) -> HttpResponse:  # type:ignore
        print("HERE")
        print("REQUEST DATA:", request.POST)
        og_teams = self.get_og_teams(pipeline)
        if request.method == "POST":
            form_2 = TeamSelectForm(data=request.POST, team_list=og_teams)
            if form_2.is_valid():
                form_data = form_2.cleaned_data

                pipeline.bind_state("team_data", form_data)

                return pipeline.next_step()
        else:
            form_2 = TeamSelectForm(team_list=og_teams)

        return render_to_response(
            template="sentry/integrations/opsgenie-config.html",
            context={"form_2": form_2},
            request=request,
        )

    def get_og_teams(self, pipeline):
        api_key = pipeline.state.data["installation_data"]["api_key"]
        base_url = pipeline.state.data["installation_data"]["base_url"]
        client = OpsgenieSetupClient(base_url=base_url, api_key=api_key)
        try:
            resp = client.get_teams()
            teams = [(i, team["name"]) for i, team in enumerate(resp["data"])]
            return teams
        except ApiError as api_error:
            logger.info(
                "opsgenie.installation.get-teams-failure",
                extra={
                    "base_url": base_url,
                    "error_message": str(api_error),
                    "error_status": api_error.code,
                },
            )
            raise IntegrationError("Could not authenticate with the provided integration key.")


class OpsgenieIntegration(IntegrationInstallation):
    def get_client(self, integration_key: str) -> Any:  # type: ignore
        org_integration_id = self.org_integration.id if self.org_integration else None
        return OpsgenieClient(
            integration=self.model,
            integration_key=integration_key,
            org_integration_id=org_integration_id,
        )

    def get_organization_config(self) -> Sequence[Any]:
        fields = [
            {
                "name": "team_table",
                "type": "table",
                "label": "Opsgenie integrations",
                "help": "If integration keys need to be updated, deleted, or added manually please do so here. Your keys must be associated with a 'Sentry' Integration in Opsgenie. \
                Alert rules will need to be individually updated for any key additions or deletions.",
                "addButtonText": "",
                "columnLabels": {
                    "team": "Opsgenie Integration",
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


class OpsgenieIntegrationProvider(IntegrationProvider):
    key = "opsgenie"
    name = "Opsgenie (Integration)"
    metadata = metadata
    integration_cls = OpsgenieIntegration
    features = frozenset([IntegrationFeatures.INCIDENT_MANAGEMENT, IntegrationFeatures.ALERT_RULE])
    requires_feature_flag = True  # limited release

    def get_account_info(self, base_url, api_key):
        client = OpsgenieSetupClient(base_url=base_url, api_key=api_key)
        try:
            resp = client.get_account()
            return resp.json
        except ApiError as api_error:
            logger.info(
                "opsgenie.installation.get-account-info-failure",
                extra={
                    "base_url": base_url,
                    "error_message": str(api_error),
                    "error_status": api_error.code,
                },
            )
            raise IntegrationError("The requested Opsgenie account could not be found.")
        except (ValueError, MissingSchema) as url_error:
            logger.info(
                "opsgenie.installation.get-account-info-failure",
                extra={
                    "base_url": base_url,
                    "error_message": str(url_error),
                },
            )
            raise IntegrationError("Invalid URL provided.")

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        return [InstallationGuideView(), InstallationConfigView(), InstallationTeamSelectView()]

    def build_integration(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        api_key = state["installation_data"]["api_key"]
        base_url = state["installation_data"]["base_url"]
        account = self.get_account_info(base_url=base_url, api_key=api_key).get("data")
        name = account.get("name")
        return {
            "name": name,
            "external_id": name,
            "metadata": {
                "api_key": api_key,
                "base_url": base_url,
                "domain_name": f"{name}.app.opsgenie.com",
            },
        }
