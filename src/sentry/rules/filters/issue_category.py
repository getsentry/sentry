from collections import OrderedDict
from typing import Any

from django import forms

from sentry.issues.grouptype import PERFORMANCE_ISSUE_CATEGORIES, GroupCategory
from sentry.models.group import Group
from sentry.rules import EventState
from sentry.rules.filters import EventFilter
from sentry.services.eventstore.models import GroupEvent
from sentry.types.condition_activity import ConditionActivity

CATEGORY_CHOICES = OrderedDict([(f"{gc.value}", str(gc.name).lower()) for gc in GroupCategory])
INCLUDE_CHOICES = OrderedDict([("true", "equal to"), ("false", "not equal to")])


class IssueCategoryForm(forms.Form):
    include = forms.ChoiceField(
        choices=list(INCLUDE_CHOICES.items()), required=False, initial="true"
    )
    value = forms.ChoiceField(choices=list(CATEGORY_CHOICES.items()))


class IssueCategoryFilter(EventFilter):
    id = "sentry.rules.filters.issue_category.IssueCategoryFilter"
    form_fields = {
        "include": {
            "type": "choice",
            "choices": list(INCLUDE_CHOICES.items()),
            "initial": "true",
        },
        "value": {"type": "choice", "choices": list(CATEGORY_CHOICES.items())},
    }
    rule_type = "filter/event"
    label = "The issue's category is {include} {value}"
    prompt = "The issue's category is ..."

    def _passes(self, group: Group) -> bool:
        try:
            value: GroupCategory = GroupCategory(int(self.get_option("value")))
        except (TypeError, ValueError):
            return False

        include_category = self.get_option("include", "true") != "false"

        if group:
            # TODO(CEO): we're only temporarily handling GroupCategory.PERFORMANCE_ISSUE_CATEGORIES until we can migrate away from that data
            # Until condition data is migrated, treat a stored PERFORMANCE value as matching any of the replacement categories too
            if value == GroupCategory.PERFORMANCE:
                category_matches = (
                    group.issue_category in PERFORMANCE_ISSUE_CATEGORIES
                    or group.issue_category == GroupCategory.PERFORMANCE
                )
            else:
                category_matches = value == group.issue_category
            return category_matches if include_category else not category_matches

        return False

    def passes(self, event: GroupEvent, state: EventState, **kwargs: Any) -> bool:
        return self._passes(event.group)

    def passes_activity(
        self, condition_activity: ConditionActivity, event_map: dict[str, Any]
    ) -> bool:
        try:
            group = Group.objects.get_from_cache(id=condition_activity.group_id)
        except Group.DoesNotExist:
            return False

        return self._passes(group)

    def render_label(self) -> str:
        value = self.data["value"]
        title = CATEGORY_CHOICES.get(value)
        group_category_name = title.title() if title else ""
        include_label = INCLUDE_CHOICES.get(self.data.get("include", "true"), "equal to")
        return self.label.format(include=include_label, value=group_category_name)

    def get_form_instance(self) -> IssueCategoryForm:
        return IssueCategoryForm(self.data)
