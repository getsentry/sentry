from __future__ import annotations

from typing import Any, Mapping

from django import forms
from django.utils.translation import gettext_lazy as _

from sentry.integrations.opsgenie.client import OpsgenieClient
from sentry.integrations.opsgenie.utils import get_team
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.integration.model import (
    RpcIntegration,
    RpcOrganizationIntegration,
)
from sentry.shared_integrations.exceptions import ApiError

INVALID_TEAM = 1
INVALID_KEY = 2
VALID_TEAM = 3


def _validate_int_field(field: str, cleaned_data: Mapping[str, Any]) -> int | None:
    value_option = cleaned_data.get(field)
    if value_option is None:
        return None

    try:
        return int(value_option)
    except ValueError:
        raise forms.ValidationError(_(f"Invalid {field}"), code="invalid")


class OpsgenieNotifyTeamForm(forms.Form):
    """Used for notifying a specific team."""

    account = forms.ChoiceField(choices=(), widget=forms.Select())
    team = forms.ChoiceField(required=False, choices=(), widget=forms.Select())
    fields: Mapping[str, forms.ChoiceField]  # type: ignore

    def __init__(self, *args, **kwargs):
        self.org_id = kwargs.pop("org_id")
        integrations = [(i.id, i.name) for i in kwargs.pop("integrations")]
        teams = kwargs.pop("teams")

        super().__init__(*args, **kwargs)
        if integrations:
            self.fields["account"].initial = integrations[0][0]

        self.fields["account"].choices = integrations
        self.fields["account"].widget.choices = self.fields["account"].choices

        if teams:
            self.fields["team"].initial = teams[0][0]

        self.fields["team"].choices = teams
        self.fields["team"].widget.choices = self.fields["team"].choices

    def _get_team_status(
        self,
        team_id: str | None,
        integration: RpcIntegration,
        org_integration: RpcOrganizationIntegration,
    ) -> int:
        team = get_team(team_id, org_integration)
        if not team or not team_id:
            return INVALID_TEAM

        integration_key = team["integration_key"]
        client = OpsgenieClient(
            integration=integration,
            integration_key=integration_key,
            org_integration_id=org_integration.id,
            keyid=team_id,
        )
        # the integration should be of type "sentry"
        # there's no way to authenticate that a key is an integration key
        # without specifying the type... even though the type is arbitrary
        # and all integration keys do the same thing
        try:
            client.authorize_integration(type="sentry")
        except ApiError:
            return INVALID_KEY

        return VALID_TEAM

    def _validate_team(self, team_id: str | None, integration_id: int | None) -> None:
        params = {
            "account": dict(self.fields["account"].choices).get(integration_id),
            "team": dict(self.fields["team"].choices).get(team_id),
        }
        integration = integration_service.get_integration(
            integration_id=integration_id, provider="opsgenie"
        )
        org_integration = integration_service.get_organization_integration(
            integration_id=integration_id,
            organization_id=self.org_id,
        )
        if integration is None or org_integration is None:
            raise forms.ValidationError(
                _("The Opsgenie integration does not exist."),
                code="invalid_integration",
                params=params,
            )
        team_status = self._get_team_status(
            team_id=team_id, integration=integration, org_integration=org_integration
        )
        if team_status == INVALID_TEAM:
            raise forms.ValidationError(
                _('The team "%(team)s" does not belong to the %(account)s Opsgenie account.'),
                code="invalid_team",
                params=params,
            )
        elif team_status == INVALID_KEY:
            raise forms.ValidationError(
                _(
                    'The provided API key is invalid. Please make sure that the Opsgenie API \
                  key is an integration key of type "Sentry".'
                ),
                code="invalid_key",
                params=params,
            )

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()
        if cleaned_data:
            integration_id = _validate_int_field("account", cleaned_data)
            team_id = cleaned_data.get("team")
            self._validate_team(team_id, integration_id)
        return cleaned_data
