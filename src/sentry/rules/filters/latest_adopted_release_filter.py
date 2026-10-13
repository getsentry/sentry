from __future__ import annotations

from sentry.rules.filters.base import EventFilter
from sentry.workflow_engine.handlers.condition.utils.age import (
    age_comparison_choices,
    model_age_choices,
)


class LatestAdoptedReleaseFilter(EventFilter):
    id = "sentry.rules.filters.latest_adopted_release_filter.LatestAdoptedReleaseFilter"
    label = "The {oldest_or_newest} release associated with the event's issue is {older_or_newer} than the latest adopted release in {environment}"

    form_fields = {
        "oldest_or_newest": {"type": "choice", "choices": list(model_age_choices)},
        "older_or_newer": {"type": "choice", "choices": list(age_comparison_choices)},
        "environment": {"type": "string", "placeholder": "value"},
    }
