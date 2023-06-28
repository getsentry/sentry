from __future__ import annotations

import operator
from datetime import datetime, timedelta
from typing import Any, Dict, Sequence, Tuple

from django import forms
from django.utils import timezone

from sentry.eventstore.models import GroupEvent
from sentry.models import Group
from sentry.rules import EventState
from sentry.rules.filters.base import EventFilter
from sentry.types.condition_activity import ConditionActivity


class AgeComparisonType:
    OLDER = "older"
    NEWER = "newer"


timeranges = {
    "minute": ("minute(s)", timedelta(minutes=1)),
    "hour": ("hour(s)", timedelta(hours=1)),
    "day": ("day(s)", timedelta(days=1)),
    "week": ("week(s)", timedelta(days=7)),
}

age_comparison_choices = [(AgeComparisonType.OLDER, "older"), (AgeComparisonType.NEWER, "newer")]

age_comparison_map = {AgeComparisonType.OLDER: operator.lt, AgeComparisonType.NEWER: operator.gt}


def get_timerange_choices() -> Sequence[Tuple[str, str]]:
    return [
        (key, label)
        for key, (label, duration) in sorted(
            timeranges.items(), key=lambda key___label__duration: key___label__duration[1][1]
        )
    ]


class AgeComparisonForm(forms.Form):
    comparison_type = forms.ChoiceField(choices=age_comparison_choices)
    value = forms.IntegerField()
    time = forms.ChoiceField(choices=get_timerange_choices)


class AgeComparisonFilter(EventFilter):
    id = "sentry.rules.filters.age_comparison.AgeComparisonFilter"
    form_cls = AgeComparisonForm
    form_fields = {
        "comparison_type": {"type": "choice", "choices": age_comparison_choices},
        "value": {"type": "number", "placeholder": 10},
        "time": {"type": "choice", "choices": get_timerange_choices()},
    }

    # An issue is newer/older than X minutes/hours/days/weeks
    label = "The issue is {comparison_type} than {value} {time}"
    prompt = "The issue is older or newer than..."

    def _passes(self, first_seen: datetime, current_time: datetime) -> bool:
        comparison_type = self.get_option("comparison_type")
        time = self.get_option("time")

        try:
            value = int(self.get_option("value"))
        except (TypeError, ValueError):
            return False

        if (
            not comparison_type
            or not time
            or time not in timeranges
            or (
                comparison_type != AgeComparisonType.OLDER
                and comparison_type != AgeComparisonType.NEWER
            )
        ):
            return False

        _, delta_time = timeranges[time]

        passes_: bool = age_comparison_map[comparison_type](
            first_seen + (value * delta_time), current_time
        )
        return passes_

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        return self._passes(event.group.first_seen, timezone.now())

    def passes_activity(
        self, condition_activity: ConditionActivity, event_map: Dict[str, Any]
    ) -> bool:
        try:
            group = Group.objects.get_from_cache(id=condition_activity.group_id)
        except Group.DoesNotExist:
            return False

        return self._passes(group.first_seen, condition_activity.timestamp)
