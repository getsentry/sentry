from typing import Any, Dict

from django import forms
from django.utils import timezone

from sentry.eventstore.models import GroupEvent
from sentry.models.group import Group
from sentry.rules import EventState
from sentry.rules.filters.base import EventFilter
from sentry.types.condition_activity import ConditionActivity


class IssueOccurrencesForm(forms.Form):
    value = forms.IntegerField()


class IssueOccurrencesFilter(EventFilter):
    id = "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter"
    form_cls = IssueOccurrencesForm
    form_fields = {"value": {"type": "number", "placeholder": 10}}
    label = "The issue has happened at least {value} times"
    prompt = "The issue has happened at least {x} times (Note: this is approximate)"

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        try:
            value = int(self.get_option("value"))
        except (TypeError, ValueError):
            return False

        # This value is slightly delayed due to us batching writes to times_seen. We attempt to work
        # around this by including pending updates from buffers to improve accuracy.
        issue_occurrences: int = event.group.times_seen_with_pending
        return bool(issue_occurrences >= value)

    def passes_activity(
        self, condition_activity: ConditionActivity, event_map: Dict[str, Any]
    ) -> bool:
        try:
            value = int(self.get_option("value"))
        except (TypeError, ValueError):
            return False

        try:
            group = Group.objects.get_from_cache(id=condition_activity.group_id)
        except Group.DoesNotExist:
            return False

        now = timezone.now()
        if now == group.first_seen:
            return bool(group.times_seen >= value)
        # assumes uniform distribution of error occurrences between first_seen and now
        guess = (
            (condition_activity.timestamp - group.first_seen)
            / (now - group.first_seen)
            * group.times_seen
        )

        return bool(guess >= value)
