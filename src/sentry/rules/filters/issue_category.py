from collections import OrderedDict
from typing import Any, Dict

from django import forms

from sentry.eventstore.models import GroupEvent
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.rules import EventState
from sentry.rules.filters import EventFilter
from sentry.types.condition_activity import ConditionActivity

CATEGORY_CHOICES = OrderedDict([(f"{gc.value}", str(gc.name).title()) for gc in GroupCategory])


class IssueCategoryForm(forms.Form):
    value = forms.ChoiceField(choices=list(CATEGORY_CHOICES.items()))


class IssueCategoryFilter(EventFilter):
    id = "sentry.rules.filters.issue_category.IssueCategoryFilter"
    form_cls = IssueCategoryForm
    form_fields = {"value": {"type": "choice", "choices": list(CATEGORY_CHOICES.items())}}
    rule_type = "filter/event"
    label = "The issue's category is equal to {value}"
    prompt = "The issue's category is ..."

    def _passes(self, group: Group) -> bool:
        try:
            value: GroupCategory = GroupCategory(int(self.get_option("value")))
        except (TypeError, ValueError):
            return False

        if group and group.issue_category:
            return bool(value == group.issue_category)

        return False

    def passes(self, event: GroupEvent, state: EventState, **kwargs: Any) -> bool:
        return self._passes(event.group)

    def passes_activity(
        self, condition_activity: ConditionActivity, event_map: Dict[str, Any]
    ) -> bool:
        try:
            group = Group.objects.get_from_cache(id=condition_activity.group_id)
        except Group.DoesNotExist:
            return False

        return self._passes(group)
