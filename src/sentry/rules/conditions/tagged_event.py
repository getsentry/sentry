from __future__ import annotations

from typing import Any

from django import forms

from sentry import tagstore
from sentry.eventstore.models import Event
from sentry.rules import MATCH_CHOICES, EventState, MatchType
from sentry.rules.conditions.base import EventCondition


class TaggedEventForm(forms.Form):  # type: ignore
    key = forms.CharField(widget=forms.TextInput())
    match = forms.ChoiceField(choices=list(MATCH_CHOICES.items()), widget=forms.Select())
    value = forms.CharField(widget=forms.TextInput(), required=False)

    def clean(self) -> dict[str, Any] | None:
        cleaned_data: dict[str, Any] = super().clean()

        match = cleaned_data.get("match")
        value = cleaned_data.get("value")

        if match not in (MatchType.IS_SET, MatchType.NOT_SET) and not value:
            raise forms.ValidationError("This field is required.")

        return None


class TaggedEventCondition(EventCondition):
    id = "sentry.rules.conditions.tagged_event.TaggedEventCondition"
    form_cls = TaggedEventForm
    label = "The event's tags match {key} {match} {value}"

    form_fields = {
        "key": {"type": "string", "placeholder": "key"},
        "match": {"type": "choice", "choices": list(MATCH_CHOICES.items())},
        "value": {"type": "string", "placeholder": "value"},
    }

    def passes(self, event: Event, state: EventState, **kwargs: Any) -> bool:
        key = self.get_option("key")
        match = self.get_option("match")
        value = self.get_option("value")

        if not (key and match):
            return False

        key = key.lower()

        tags = (
            k
            for gen in (
                (k.lower() for k, v in event.tags),
                (tagstore.get_standardized_key(k) for k, v in event.tags),
            )
            for k in gen
        )

        if match == MatchType.IS_SET:
            return key in tags

        elif match == MatchType.NOT_SET:
            return key not in tags

        if not value:
            return False

        value = value.lower()

        values = (
            v.lower()
            for k, v in event.tags
            if k.lower() == key or tagstore.get_standardized_key(k) == key
        )

        if match == MatchType.EQUAL:
            for t_value in values:
                if t_value == value:
                    return True
            return False

        elif match == MatchType.NOT_EQUAL:
            for t_value in values:
                if t_value == value:
                    return False
            return True

        elif match == MatchType.STARTS_WITH:
            for t_value in values:
                if t_value.startswith(value):
                    return True
            return False

        elif match == MatchType.NOT_STARTS_WITH:
            for t_value in values:
                if t_value.startswith(value):
                    return False
            return True

        elif match == MatchType.ENDS_WITH:
            for t_value in values:
                if t_value.endswith(value):
                    return True
            return False

        elif match == MatchType.NOT_ENDS_WITH:
            for t_value in values:
                if t_value.endswith(value):
                    return False
            return True

        elif match == MatchType.CONTAINS:
            for t_value in values:
                if value in t_value:
                    return True
            return False

        elif match == MatchType.NOT_CONTAINS:
            for t_value in values:
                if value in t_value:
                    return False
            return True

        raise RuntimeError("Invalid Match")

    def render_label(self) -> str:
        data = {
            "key": self.data["key"],
            "value": self.data["value"],
            "match": MATCH_CHOICES[self.data["match"]],
        }
        return self.label.format(**data)
