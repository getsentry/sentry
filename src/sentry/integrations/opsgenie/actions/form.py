from __future__ import annotations

from typing import Any, Mapping

from django import forms
from django.utils.translation import gettext_lazy as _


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
        # print("INTEGRATIONS_FORMS:", integrations)
        teams = kwargs.pop("teams")
        # print("TEAMS_FORMS:", teams)

        super().__init__(*args, **kwargs)
        if integrations:
            self.fields["account"].initial = integrations[0][0]

        self.fields["account"].choices = integrations
        self.fields["account"].widget.choices = self.fields["account"].choices

        if teams:
            self.fields["team"].initial = teams[0][0]

        self.fields["team"].choices = teams
        self.fields["team"].widget.choices = self.fields["team"].choices

    # def _find_team(self, team_id: int) -> bool:

    # def _validate_team(self, team_id: int, integration_id: int | None) -> None:
    #     params = {
    #         "account": dict(self.fields["account"].choices).get(integration_id),
    #         "team": dict(self.fields["service"].choices).get(team_id),
    #     }

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()

        # integration_id = _validate_int_field("account", cleaned_data)
        # team_id = _validate_int_field("team", cleaned_data)

        return cleaned_data
