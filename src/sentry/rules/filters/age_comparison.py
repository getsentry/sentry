from __future__ import annotations

from sentry.rules.filters.base import EventFilter
from sentry.workflow_engine.handlers.condition.utils.age import (
    age_comparison_choices,
    get_timerange_choices,
)


class AgeComparisonFilter(EventFilter):
    id = "sentry.rules.filters.age_comparison.AgeComparisonFilter"
    form_fields = {
        "comparison_type": {"type": "choice", "choices": age_comparison_choices},
        "value": {"type": "number", "placeholder": 10},
        "time": {"type": "choice", "choices": get_timerange_choices()},
    }

    # An issue is newer/older than X minutes/hours/days/weeks
    label = "The issue is {comparison_type} than {value} {time}"
    prompt = "The issue is older or newer than..."
