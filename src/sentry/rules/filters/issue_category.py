from collections import OrderedDict
from typing import Any

from django import forms

from sentry.eventstore.models import GroupEvent
from sentry.rules import EventState
from sentry.rules.filters import EventFilter
from sentry.types.issues import GroupCategory

CATEGORY_CHOICES = OrderedDict([(f"{gc.value}", str(gc.name).title()) for gc in GroupCategory])


class IssueCategoryForm(forms.Form):  # type: ignore
    value = forms.ChoiceField(choices=list(CATEGORY_CHOICES.items()))


class IssueCategoryFilter(EventFilter):
    id = "sentry.rules.filters.issue_category.IssueCategoryFilter"
    form_cls = IssueCategoryForm
    form_fields = {"value": {"type": "choice", "choices": list(CATEGORY_CHOICES.items())}}
    rule_type = "filter/event"
    label = "The issue's category is equal to {value}"
    prompt = "The issue's category is ..."

    def passes(self, event: GroupEvent, state: EventState, **kwargs: Any) -> bool:
        try:
            value: GroupCategory = GroupCategory(int(self.get_option("value")))
        except (TypeError, ValueError):
            return False

        if event.group and event.group.issue_category:
            return bool(value == event.group.issue_category)

        return False
