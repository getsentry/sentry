from __future__ import annotations

from typing import Any

from django import forms
from django.core.validators import RegexValidator

from sentry.rules.conditions.base import EventCondition
from sentry.tagstore.base import TAG_KEY_RE
from sentry.workflow_engine.handlers.condition.utils.match import MATCH_CHOICES, MatchType


class TaggedEventForm(forms.Form):
    key = forms.CharField(
        widget=forms.TextInput(),
        validators=[RegexValidator(TAG_KEY_RE, "Invalid tag key format.")],
    )
    match = forms.ChoiceField(choices=list(MATCH_CHOICES.items()), widget=forms.Select())
    value = forms.CharField(widget=forms.TextInput(), required=False)

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()
        if cleaned_data is None:
            return None

        match = cleaned_data.get("match")
        value = cleaned_data.get("value")

        if match not in (MatchType.IS_SET, MatchType.NOT_SET) and not value:
            raise forms.ValidationError("This field is required.")

        return None


class TaggedEventCondition(EventCondition):
    id = "sentry.rules.conditions.tagged_event.TaggedEventCondition"
    label = "The event's tags match {key} {match} {value}"

    form_fields = {
        "key": {"type": "string", "placeholder": "key"},
        "match": {"type": "choice", "choices": list(MATCH_CHOICES.items())},
        "value": {"type": "string", "placeholder": "value"},
    }

    def render_label(self) -> str:
        data = {
            "key": self.data["key"],
            "value": self.data["value"],
            "match": MATCH_CHOICES[self.data["match"]],
        }
        return self.label.format(**data)

    def get_form_instance(self) -> TaggedEventForm:
        return TaggedEventForm(self.data)
