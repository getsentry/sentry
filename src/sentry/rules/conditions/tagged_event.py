from __future__ import annotations

from sentry.rules.conditions.base import EventCondition
from sentry.workflow_engine.handlers.condition.utils.match import MATCH_CHOICES


class TaggedEventCondition(EventCondition):
    id = "sentry.rules.conditions.tagged_event.TaggedEventCondition"
    label = "The event's tags match {key} {match} {value}"

    form_fields = {
        "key": {"type": "string", "placeholder": "key"},
        "match": {"type": "choice", "choices": list(MATCH_CHOICES.items())},
        "value": {"type": "string", "placeholder": "value"},
    }

    def render_label(self) -> str:
        data = {
            "key": self.data["key"],
            "value": self.data["value"],
            "match": MATCH_CHOICES[self.data["match"]],
        }
        return self.label.format(**data)
