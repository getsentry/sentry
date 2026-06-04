from typing import Any

from django import forms

from sentry.rules.actions.integrations.base import INTEGRATION_KEY
from sentry.utils.forms import set_field_choices


class IntegrationNotifyServiceForm(forms.Form):
    integration = forms.ChoiceField(choices=(), widget=forms.Select())

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        integrations = [(i.id, i.name) for i in kwargs.pop("integrations")]
        super().__init__(*args, **kwargs)
        if integrations:
            self.fields[INTEGRATION_KEY].initial = integrations[0][0]

        set_field_choices(self.fields[INTEGRATION_KEY], integrations)
