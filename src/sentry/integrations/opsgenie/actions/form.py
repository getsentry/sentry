from __future__ import annotations

from typing import Any, Mapping

from django import forms
from django.utils.translation import gettext_lazy as _

from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.integration.model import RpcOrganizationIntegration


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

    def __init__(self, *args, **kwargs):
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

    def _team_is_valid(
        self, team_id: int, org_integrations: list[RpcOrganizationIntegration]
    ) -> bool:
        for oi in org_integrations:
            teams = oi.config.get("team_table")
            if not teams:
                continue
            for team in teams:
                if team["id"] == team_id:
                    return True
        return False

    def _validate_team(self, team_id: int, integration_id: int | None) -> None:
        params = {
            "account": dict(self.fields["account"].choices).get(integration_id),
            "team": dict(self.fields["team"].choices).get(team_id),
        }
        org_integrations = integration_service.get_organization_integrations(
            integration_id=integration_id,
            providers=["opsgenie"],
        )

        if not self._team_is_valid(team_id=team_id, org_integrations=org_integrations):
            raise forms.ValidationError(
                _('The team "%(team)s" does not belong to the %(account)s Opsgenie account.'),
                code="invalid",
                params=params,
            )

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()
        integration_id = _validate_int_field("account", cleaned_data)
        team_id = cleaned_data.get("team")
        self._validate_team(team_id, integration_id)

        return cleaned_data
