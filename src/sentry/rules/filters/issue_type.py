from collections import OrderedDict
from typing import Any

from django import forms

from sentry.issues import grouptype
from sentry.models.group import Group
from sentry.rules import EventState
from sentry.rules.filters import EventFilter
from sentry.services.eventstore.models import GroupEvent
from sentry.types.condition_activity import ConditionActivity


def get_type_choices() -> OrderedDict[str, str]:
    """Generate choices from all registered group types.

    Must be called at request time, not module import time, because group types
    from other apps (e.g. sentry.incidents.grouptype.MetricIssue) are registered
    later during import_grouptype().
    """
    type_choices = OrderedDict()
    for group_type_cls in grouptype.registry.all():
        if not group_type_cls.released:
            continue
        display_name = getattr(group_type_cls, "description", None) or group_type_cls.slug
        type_choices[group_type_cls.slug] = display_name
    return type_choices


INCLUDE_CHOICES = OrderedDict([("true", "equal to"), ("false", "not equal to")])


class IssueTypeForm(forms.Form):
    include = forms.ChoiceField(
        choices=list(INCLUDE_CHOICES.items()), required=False, initial="true"
    )
    value = forms.ChoiceField(choices=[])

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields["value"] = forms.ChoiceField(choices=list(get_type_choices().items()))


class IssueTypeFilter(EventFilter):
    id = "sentry.rules.filters.issue_type.IssueTypeFilter"
    rule_type = "filter/event"
    label = "The issue's type is {include} {value}"
    prompt = "The issue's type is ..."

    @property
    def form_fields(self) -> dict[str, Any]:
        return {
            "include": {
                "type": "choice",
                "choices": list(INCLUDE_CHOICES.items()),
                "initial": "true",
            },
            "value": {"type": "choice", "choices": list(get_type_choices().items())},
        }

    def _passes(self, group: Group) -> bool:
        try:
            comparison_value = self.get_option("value")
            if not isinstance(comparison_value, str):
                return False
            value = grouptype.registry.get_by_slug(comparison_value)
            if value is None:
                return False
        except (TypeError, KeyError):
            return False

        include_type = self.get_option("include", "true") != "false"

        if group:
            type_matches = group.issue_type == value
            return type_matches if include_type else not type_matches

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
        type_choices = get_type_choices()
        title = type_choices.get(value)
        issue_type_name = title if title else ""
        include_label = INCLUDE_CHOICES.get(self.data.get("include", "true"), "equal to")
        return self.label.format(include=include_label, value=issue_type_name)

    def get_form_instance(self) -> IssueTypeForm:
        return IssueTypeForm(self.data)
