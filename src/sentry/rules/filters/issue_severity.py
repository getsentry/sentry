from collections import OrderedDict
from typing import Any, Dict

from django import forms

from sentry.eventstore.models import GroupEvent
from sentry.issues.grouptype import GroupCategory
from sentry.models import Group
from sentry.rules import EventState, MatchType
from sentry.rules.filters import EventFilter
from sentry.types.condition_activity import ConditionActivity

SEVERITY_MATCH_CHOICES = {
    MatchType.GREATER_OR_EQUAL: "greater than or equal to",
    MatchType.LESS_OR_EQUAL: "less than or equal to",
}
CATEGORY_CHOICES = OrderedDict([(f"{gc.value}", str(gc.name).title()) for gc in GroupCategory])


class IssueSeverityForm(forms.Form):
    value = forms.NumberInput()


class IssueSeverityFilter(EventFilter):
    id = "sentry.rules.filters.issue_severity.IssueSeverityFilter"
    form_cls = IssueSeverityForm
    form_fields = {
        "value": {"type": "number", "placeholder": 0.5},
        "match": {"type": "choice", "choices": list(SEVERITY_MATCH_CHOICES.items())},
    }
    rule_type = "filter/event"
    label = "The issue's severity is {match} {value}"
    prompt = "The issue's serverity is ..."

    def _passes(self, group: Group):
        if not group:
            return False

        match = self.get_option("match")

        try:
            severity = float(group.get_event_metadata()["severity"])
            value = float(self.get_option("value"))
        except (TypeError, ValueError):
            return False

        if match == MatchType.GREATER_OR_EQUAL:
            return severity >= value
        elif match == MatchType.LESS_OR_EQUAL:
            return severity <= value

        return False

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        return self._passes(event.group)

    def passes_activity(
        self, condition_activity: ConditionActivity, event_map: Dict[str, Any]
    ) -> bool:
        try:
            group = Group.objects.get_from_cache(id=condition_activity.group_id)
        except Group.DoesNotExist:
            return False

        return self._passes(group)
