from __future__ import annotations

from django import forms

from sentry.rules.conditions.base import EventCondition
from sentry.workflow_engine.handlers.condition.utils.event_attribute import ATTR_CHOICES
from sentry.workflow_engine.handlers.condition.utils.match import MATCH_CHOICES


class EventAttributeForm(forms.Form):
    attribute = forms.ChoiceField(choices=[(a, a) for a in ATTR_CHOICES.keys()])
    match = forms.ChoiceField(choices=list(MATCH_CHOICES.items()))
    value = forms.CharField(widget=forms.TextInput(), required=False)


class EventAttributeCondition(EventCondition):
    """Match a logical event attribute such as message, user.email, or exception.type."""

    id = "sentry.rules.conditions.event_attribute.EventAttributeCondition"
    label = "The event's {attribute} value {match} {value}"

    form_fields = {
        "attribute": {
            "type": "choice",
            "placeholder": "i.e. exception.type",
            "choices": [[a, a] for a in ATTR_CHOICES.keys()],
        },
        "match": {"type": "choice", "choices": list(MATCH_CHOICES.items())},
        "value": {"type": "string", "placeholder": "value"},
    }

    def render_label(self) -> str:
        data = {
            "attribute": self.data["attribute"],
            "value": self.data["value"],
            "match": MATCH_CHOICES[self.data["match"]],
        }
        return self.label.format(**data)

    def get_form_instance(self) -> EventAttributeForm:
        return EventAttributeForm(self.data)
