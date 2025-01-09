from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from django import forms
from django.utils.translation import gettext_lazy as _

from sentry.integrations.on_call.metrics import OnCallIntegrationsHaltReason, OnCallInteractionType
from sentry.integrations.opsgenie.metrics import record_event
from sentry.integrations.opsgenie.utils import get_team
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcOrganizationIntegration

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
    fields: Mapping[str, forms.ChoiceField]  # type: ignore[assignment]

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
        org_integration: RpcOrganizationIntegration,
    ) -> int:
        team = get_team(team_id, org_integration)
        if not team or not team_id:
            return INVALID_TEAM

        return VALID_TEAM

    def _validate_team(self, team_id: str | None, integration_id: int | None) -> None:
        with record_event(OnCallInteractionType.VERIFY_TEAM).capture() as lifecyle:
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
                lifecyle.record_halt(OnCallIntegrationsHaltReason.INVALID_TEAM)
                raise forms.ValidationError(
                    _("The Opsgenie integration does not exist."),
                    code="invalid_integration",
                    params=params,
                )

            team_status = self._get_team_status(team_id=team_id, org_integration=org_integration)
            if team_status == INVALID_TEAM:
                lifecyle.record_halt(OnCallIntegrationsHaltReason.INVALID_TEAM)
                raise forms.ValidationError(
                    _('The team "%(team)s" does not belong to the %(account)s Opsgenie account.'),
                    code="invalid_team",
                    params=params,
                )

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()
        if cleaned_data:
            integration_id = _validate_int_field("account", cleaned_data)
            team_id = cleaned_data.get("team")
            self._validate_team(team_id, integration_id)
        return cleaned_data
