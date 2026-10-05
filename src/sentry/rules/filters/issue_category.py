from collections import OrderedDict

from django import forms

from sentry.issues.grouptype import GroupCategory
from sentry.rules.filters import EventFilter

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

    def render_label(self) -> str:
        value = self.data["value"]
        title = CATEGORY_CHOICES.get(value)
        group_category_name = title.title() if title else ""
        include_label = INCLUDE_CHOICES.get(self.data.get("include", "true"), "equal to")
        return self.label.format(include=include_label, value=group_category_name)

    def get_form_instance(self) -> IssueCategoryForm:
        return IssueCategoryForm(self.data)
