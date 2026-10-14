from __future__ import annotations

from typing import Any, Literal, NotRequired

from sentry.rules.base import RuleBase
from sentry.rules.conditions.base import GenericCondition
from sentry.workflow_engine.handlers.condition.utils.event_frequency import (
    EVENT_UNIQUE_USER_FREQUENCY_WITH_CONDITIONS_ID,
    PERCENT_INTERVALS,
    PERCENT_INTERVALS_TO_DISPLAY,
    STANDARD_INTERVALS,
    ComparisonType,
)


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


class EventFrequencyCondition(BaseEventFrequencyCondition):
    id = "sentry.rules.conditions.event_frequency.EventFrequencyCondition"
    label = "The issue is seen more than {value} times in {interval}"


class EventUniqueUserFrequencyCondition(BaseEventFrequencyCondition):
    id = "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition"
    label = "The issue is seen by more than {value} users in {interval}"


class EventUniqueUserFrequencyConditionWithConditions(EventUniqueUserFrequencyCondition):
    id = EVENT_UNIQUE_USER_FREQUENCY_WITH_CONDITIONS_ID
    label = "The issue is seen by more than {value} users in {interval} with conditions"


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
