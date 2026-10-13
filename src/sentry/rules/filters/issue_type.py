from collections import OrderedDict

from sentry.issues import grouptype
from sentry.rules.filters import EventFilter


def get_type_choices() -> list[tuple[str, str]]:
    """Generate choices from all registered group types."""
    return [
        # Use slug as value, description for display
        (group_type_cls.slug, getattr(group_type_cls, "description", group_type_cls.slug))
        for group_type_cls in grouptype.registry.all()
        if group_type_cls.released
    ]


INCLUDE_CHOICES = OrderedDict([("true", "equal to"), ("false", "not equal to")])


class IssueTypeFilter(EventFilter):
    id = "sentry.rules.filters.issue_type.IssueTypeFilter"
    rule_type = "filter/event"
    label = "The issue's type is {include} {value}"
    prompt = "The issue's type is ..."

    @property
    def form_fields(self) -> dict:
        return {
            "include": {
                "type": "choice",
                "choices": list(INCLUDE_CHOICES.items()),
                "initial": "true",
            },
            "value": {"type": "choice", "choices": get_type_choices()},
        }

    def render_label(self) -> str:
        value = self.data["value"]
        # Look up the GroupType at call time so the registry is fully populated;
        # GroupType.description is the human-readable display name (e.g. "Error").
        group_type = grouptype.registry.get_by_slug(value)
        issue_type_name = (getattr(group_type, "description", None) or value) if group_type else ""
        include_label = INCLUDE_CHOICES.get(self.data.get("include", "true"), "equal to")
        return self.label.format(include=include_label, value=issue_type_name)
