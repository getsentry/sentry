import logging
from typing import Any

from django import forms


class FakeLogServiceForm(forms.Form):
    identifier = forms.CharField(required=True, widget=forms.TextInput())

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)

        self.fields["identifier"].initial = "something_something"

    def clean(self) -> dict[str, Any] | None:
        cleaned_data: dict[str, Any] = super().clean()
        logging.info("sentry.fake_log_service_form", extra={"form": self.cleaned_data})
        identifier = cleaned_data.get("identifier")
        assert identifier is not None, "Identifier is required"
        return cleaned_data
