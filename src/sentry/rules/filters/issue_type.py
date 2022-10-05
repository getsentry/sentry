from collections import OrderedDict
from typing import Any, Union

from django import forms

from sentry.eventstore.models import Event, GroupEvent
from sentry.rules import EventState
from sentry.rules.filters import EventFilter
from sentry.types.issues import GroupType

TYPE_DESCRIPTIONS = {
    GroupType.ERROR.value: "Errors",
    GroupType.PERFORMANCE_N_PLUS_ONE.value: "Performance (N+1)",
    GroupType.PERFORMANCE_SLOW_SPAN.value: "Performance (slow span)",
    GroupType.PERFORMANCE_SEQUENTIAL_SLOW_SPANS.value: "Performance (sequential slow spans)",
    GroupType.PERFORMANCE_LONG_TASK_SPANS.value: "Performance (long task spans)",
    GroupType.PERFORMANCE_RENDER_BLOCKING_ASSET_SPAN.value: "Performance (render blocking asset span)",
    GroupType.PERFORMANCE_DUPLICATE_SPANS.value: "Performance (duplicate spans)",
    GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES.value: "Performance (N+1 DB queries)",
}

TYPE_CHOICES = OrderedDict([(f"{gt.value}", TYPE_DESCRIPTIONS.get(gt.value)) for gt in GroupType])


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
