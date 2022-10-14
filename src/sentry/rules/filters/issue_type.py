from collections import OrderedDict
from typing import Any, Union

from django import forms

from sentry.eventstore.models import Event, GroupEvent
from sentry.rules import EventState
from sentry.rules.filters import EventFilter
from sentry.types.issues import GroupType

ENABLED_GROUP_TYPES = [
    GroupType.ERROR,
    GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
]

TYPE_DESCRIPTIONS = {
    GroupType.ERROR.value: "Errors",
    GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES.value: "Performance (N+1 queries)",
}

TYPE_CHOICES = OrderedDict(
    [(f"{gt.value}", TYPE_DESCRIPTIONS.get(gt.value)) for gt in ENABLED_GROUP_TYPES]
)


class IssueTypeForm(forms.Form):  # type: ignore
    value = forms.ChoiceField(choices=list(TYPE_CHOICES.items()))


class IssueTypeFilter(EventFilter):
    id = "sentry.rules.filters.issue_type.IssueTypeFilter"
    form_cls = IssueTypeForm
    form_fields = {"value": {"type": "choice", "choices": list(TYPE_CHOICES.items())}}
    rule_type = "filter/event"
    label = "The issue's type is equal to {value}"
    prompt = "The issue's type is ..."

    def passes(self, event: Union[Event, GroupEvent], state: EventState, **kwargs: Any) -> bool:
        try:
            value: GroupType = GroupType(int(self.get_option("value")))
        except (TypeError, ValueError):
            return False

        if event.group and event.group.issue_type:
            return bool(value == event.group.issue_type)

        return False
