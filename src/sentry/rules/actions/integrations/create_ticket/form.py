from typing import Any

from django import forms

from sentry.rules.actions.integrations.base import INTEGRATION_KEY


class IntegrationNotifyServiceForm(forms.Form):
    integration = forms.ChoiceField(choices=(), widget=forms.Select())

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        integrations = [(i.id, i.name) for i in kwargs.pop("integrations")]
        super().__init__(*args, **kwargs)
        if integrations:
            self.fields[INTEGRATION_KEY].initial = integrations[0][0]

        self.fields[INTEGRATION_KEY].choices = integrations
        self.fields[INTEGRATION_KEY].widget.choices = self.fields[INTEGRATION_KEY].choices
