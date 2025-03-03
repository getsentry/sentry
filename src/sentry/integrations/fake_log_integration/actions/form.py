import logging
from typing import Any

from django import forms


class FakeLogServiceForm(forms.Form):
    identifier = forms.CharField(required=True, widget=forms.TextInput())
    log_key = forms.ChoiceField(choices=(), widget=forms.Select())

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        logger_list = [(i.id, i.name) for i in kwargs.pop("integrations")]

        super().__init__(*args, **kwargs)
        self.fields["identifier"].initial = "something_something"
        self.fields["log_key"].choices = logger_list
        logging.info("sentry.fake_log_service_form_init", extra={"logger": logger_list})
        self.fields["log_key"].widget.choices = self.fields["log_key"].choices

    def clean(self) -> dict[str, Any] | None:
        cleaned_data: dict[str, Any] = super().clean()
        logging.info("sentry.fake_log_service_form", extra={"form": self.cleaned_data})
        identifier = cleaned_data.get("identifier")
        assert identifier is not None, "Identifier is required"
        assert cleaned_data.get("log_key") is not None
        return cleaned_data
