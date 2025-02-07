from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from django import forms

from sentry import tagstore
from sentry.eventstore.models import GroupEvent
from sentry.rules import MATCH_CHOICES, EventState, MatchType, match_values
from sentry.rules.conditions.base import EventCondition
from sentry.rules.history.preview_strategy import get_dataset_columns
from sentry.snuba.dataset import Dataset
from sentry.snuba.events import Columns
from sentry.types.condition_activity import ConditionActivity


class TaggedEventForm(forms.Form):
    key = forms.CharField(widget=forms.TextInput())
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

    def _passes(self, raw_tags: Sequence[tuple[str, Any]]) -> bool:
        option_key = self.get_option("key")
        option_match = self.get_option("match")
        option_value = self.get_option("value")

        if not (option_key and option_match):
            return False

        option_key = option_key.lower()

        tag_keys = (
            k
            for gen in (
                (k.lower() for k, v in raw_tags),
                (tagstore.backend.get_standardized_key(k) for k, v in raw_tags),
            )
            for k in gen
        )

        # NOTE: IS_SET condition differs btw tagged_event and event_attribute so not handled by match_values
        if option_match == MatchType.IS_SET:
            return option_key in tag_keys

        elif option_match == MatchType.NOT_SET:
            return option_key not in tag_keys

        if not option_value:
            return False

        option_value = option_value.lower()

        # This represents the fetched tag values given the provided key
        # so eg. if the key is 'environment' and the tag_value is 'production'
        tag_values = (
            v.lower()
            for k, v in raw_tags
            if k.lower() == option_key or tagstore.backend.get_standardized_key(k) == option_key
        )

        return match_values(
            group_values=tag_values, match_value=option_value, match_type=option_match
        )

    def passes(self, event: GroupEvent, state: EventState, **kwargs: Any) -> bool:
        return self._passes(event.tags)

    def passes_activity(
        self, condition_activity: ConditionActivity, event_map: dict[str, Any]
    ) -> bool:
        try:
            tags = event_map[condition_activity.data["event_id"]]["tags"]
            return self._passes(tags.items())
        except (TypeError, KeyError):
            return False

    def render_label(self) -> str:
        data = {
            "key": self.data["key"],
            "value": self.data["value"],
            "match": MATCH_CHOICES[self.data["match"]],
        }
        return self.label.format(**data)

    def get_event_columns(self) -> dict[Dataset, Sequence[str]]:
        columns: dict[Dataset, Sequence[str]] = get_dataset_columns(
            [Columns.TAGS_KEY, Columns.TAGS_VALUE]
        )
        return columns

    def get_form_instance(self) -> TaggedEventForm:
        return TaggedEventForm(self.data)
