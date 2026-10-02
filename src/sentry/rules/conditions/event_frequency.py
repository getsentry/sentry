from __future__ import annotations

from datetime import timedelta
from typing import Any, Literal, NotRequired

from django import forms
from django.db.models.enums import TextChoices

from sentry.rules.base import RuleBase
from sentry.rules.conditions.base import GenericCondition

STANDARD_INTERVALS: dict[str, tuple[str, timedelta]] = {
    "1m": ("one minute", timedelta(minutes=1)),
    "5m": ("5 minutes", timedelta(minutes=5)),
    "15m": ("15 minutes", timedelta(minutes=15)),
    "1h": ("one hour", timedelta(hours=1)),
    "1d": ("one day", timedelta(hours=24)),
    "1w": ("one week", timedelta(days=7)),
    "30d": ("30 days", timedelta(days=30)),
}
COMPARISON_INTERVALS: dict[str, tuple[str, timedelta]] = {
    "5m": ("5 minutes", timedelta(minutes=5)),
    "15m": ("15 minutes", timedelta(minutes=15)),
    "1h": ("one hour", timedelta(hours=1)),
    "1d": ("one day", timedelta(hours=24)),
    "1w": ("one week", timedelta(days=7)),
    "30d": ("30 days", timedelta(days=30)),
}
SNUBA_LIMIT = 10000


class ComparisonType(TextChoices):
    COUNT = "count"
    PERCENT = "percent"


class EventFrequencyConditionData(GenericCondition):
    """
    The base typed dict for all condition data representing EventFrequency issue
    alert rule conditions
    """

    # Either the count or percentage.
    value: int | float
    # The interval to compare the value against such as 5m, 1h, 3w, etc.
    # e.g. # of issues is more than {value} in {interval}.
    interval: str
    # NOTE: Some of the earliest COUNT conditions were created without the
    # comparisonType field, although modern rules will always have it.
    comparisonType: NotRequired[Literal[ComparisonType.COUNT, ComparisonType.PERCENT]]
    # The previous interval to compare the curr interval against. This is only
    # present in PERCENT conditions.
    # e.g. # of issues is 50% higher in {interval} compared to {comparisonInterval}
    comparisonInterval: NotRequired[str]


class EventFrequencyForm(forms.Form):
    intervals = STANDARD_INTERVALS
    interval = forms.ChoiceField(
        choices=[
            (key, label)
            for key, (label, _) in sorted(
                intervals.items(), key=lambda key____label__duration: key____label__duration[1][1]
            )
        ]
    )
    value = forms.IntegerField(widget=forms.TextInput())
    comparisonType = forms.ChoiceField(
        choices=ComparisonType,
        required=False,
    )
    comparisonInterval = forms.ChoiceField(
        choices=[
            (key, label)
            for key, (label, _) in sorted(COMPARISON_INTERVALS.items(), key=lambda item: item[1][1])
        ],
        required=False,
    )

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()
        if cleaned_data is None:
            return None

        # Don't store an empty string here if the value isn't passed
        if cleaned_data.get("comparisonInterval") == "":
            del cleaned_data["comparisonInterval"]
        cleaned_data["comparisonType"] = cleaned_data.get("comparisonType") or ComparisonType.COUNT
        if cleaned_data["comparisonType"] == ComparisonType.PERCENT and not cleaned_data.get(
            "comparisonInterval"
        ):
            msg = forms.ValidationError("comparisonInterval is required when comparing by percent")
            self.add_error("comparisonInterval", msg)
            return None
        return cleaned_data


class BaseEventFrequencyCondition(RuleBase):
    rule_type = "condition/event"
    intervals = STANDARD_INTERVALS

    def __init__(
        self,
        # Data specifically takes on this typeddict form for the
        # Event Frequency condition classes.
        data: EventFrequencyConditionData | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        self.form_fields = {
            "value": {"type": "number", "placeholder": 100},
            "interval": {
                "type": "choice",
                "choices": [
                    (key, label)
                    for key, (label, duration) in sorted(
                        self.intervals.items(),
                        key=lambda key____label__duration: key____label__duration[1][1],
                    )
                ],
            },
        }
        kwargs["data"] = data

        super().__init__(*args, **kwargs)

    def get_form_instance(self) -> EventFrequencyForm:
        return EventFrequencyForm(self.data)


class EventFrequencyCondition(BaseEventFrequencyCondition):
    id = "sentry.rules.conditions.event_frequency.EventFrequencyCondition"
    label = "The issue is seen more than {value} times in {interval}"


class EventUniqueUserFrequencyCondition(BaseEventFrequencyCondition):
    id = "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition"
    label = "The issue is seen by more than {value} users in {interval}"


class EventUniqueUserFrequencyConditionWithConditions(EventUniqueUserFrequencyCondition):
    id = "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions"
    label = "The issue is seen by more than {value} users in {interval} with conditions"


PERCENT_INTERVALS: dict[str, tuple[str, timedelta]] = {
    "1m": ("1 minute", timedelta(minutes=1)),
    "5m": ("5 minutes", timedelta(minutes=5)),
    "10m": ("10 minutes", timedelta(minutes=10)),
    "30m": ("30 minutes", timedelta(minutes=30)),
    "1h": ("1 hour", timedelta(minutes=60)),
}

PERCENT_INTERVALS_TO_DISPLAY: dict[str, tuple[str, timedelta]] = {
    "5m": ("5 minutes", timedelta(minutes=5)),
    "10m": ("10 minutes", timedelta(minutes=10)),
    "30m": ("30 minutes", timedelta(minutes=30)),
    "1h": ("1 hour", timedelta(minutes=60)),
}
MIN_SESSIONS_TO_FIRE = 50


class EventFrequencyPercentForm(EventFrequencyForm):
    intervals = PERCENT_INTERVALS_TO_DISPLAY
    interval = forms.ChoiceField(
        choices=[
            (key, label)
            for key, (label, duration) in sorted(
                PERCENT_INTERVALS_TO_DISPLAY.items(),
                key=lambda key____label__duration: key____label__duration[1][1],
            )
        ]
    )
    value = forms.FloatField(widget=forms.TextInput(), min_value=0)

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()
        if (
            cleaned_data
            and cleaned_data["comparisonType"] == ComparisonType.COUNT
            and cleaned_data.get("value", 0) > 100
        ):
            self.add_error(
                "value", forms.ValidationError("Ensure this value is less than or equal to 100")
            )
            return None

        return cleaned_data


class EventFrequencyPercentCondition(BaseEventFrequencyCondition):
    id = "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition"
    label = "The issue affects more than {value} percent of sessions in {interval}"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.intervals = PERCENT_INTERVALS
        super().__init__(*args, **kwargs)

        # Override form fields interval to hide 1 min option from ui, but leave
        # it available to process existing 1m rules.
        self.form_fields["interval"] = {
            "type": "choice",
            "choices": [
                (key, label)
                for key, (label, duration) in sorted(
                    PERCENT_INTERVALS_TO_DISPLAY.items(),
                    key=lambda key____label__duration: key____label__duration[1][1],
                )
            ],
        }

    def get_form_instance(self) -> EventFrequencyPercentForm:
        return EventFrequencyPercentForm(self.data)


def percent_increase(result: int | float, comparison_result: int | float) -> int:
    # No baseline to compare against: treat the current count as the full increase over an
    # effectively empty prior period, i.e. 0 -> N reads as N*100%.
    if comparison_result <= 0:
        return int(max(0, result) * 100)

    change = (result - comparison_result) / comparison_result * 100
    return int(max(0, change))
