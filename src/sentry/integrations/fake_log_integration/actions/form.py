import logging
from typing import Any

from django import forms

from sentry.utils.forms import set_field_choices


class FakeLogServiceForm(forms.Form):
    identifier = forms.CharField(required=True, widget=forms.TextInput())
    log_key = forms.ChoiceField(choices=(), widget=forms.Select())

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        logger_list = [(i.id, i.name) for i in kwargs.pop("integrations")]

        super().__init__(*args, **kwargs)
        self.fields["identifier"].initial = "something_something"
        logging.info("sentry.fake_log_service_form_init", extra={"logger": logger_list})
        set_field_choices(self.fields["log_key"], logger_list)

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean() or {}
        logging.info("sentry.fake_log_service_form", extra={"form": self.cleaned_data})
        identifier = cleaned_data.get("identifier")
        assert identifier is not None, "Identifier is required"
        assert cleaned_data.get("log_key") is not None
        return cleaned_data
