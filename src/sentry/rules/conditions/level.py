from __future__ import annotations

from collections.abc import Callable

from django import forms

from sentry.constants import LOG_LEVELS
from sentry.rules.conditions.base import EventCondition
from sentry.workflow_engine.handlers.condition.utils.match import (
    LEVEL_MATCH_CHOICES as MATCH_CHOICES,
)

key: Callable[[tuple[int, str]], int] = lambda x: x[0]
LEVEL_CHOICES = {f"{k}": v for k, v in sorted(LOG_LEVELS.items(), key=key, reverse=True)}


class LevelEventForm(forms.Form):
    level = forms.ChoiceField(choices=list(LEVEL_CHOICES.items()))
    match = forms.ChoiceField(choices=list(MATCH_CHOICES.items()))


class LevelCondition(EventCondition):
    id = "sentry.rules.conditions.level.LevelCondition"
    label = "The event's level is {match} {level}"
    form_fields = {
        "level": {"type": "choice", "choices": list(LEVEL_CHOICES.items())},
        "match": {"type": "choice", "choices": list(MATCH_CHOICES.items())},
    }

    def render_label(self) -> str:
        data = {
            "level": LEVEL_CHOICES[self.data["level"]],
            "match": MATCH_CHOICES[self.data["match"]],
        }
        return self.label.format(**data)

    def get_form_instance(self) -> LevelEventForm:
        return LevelEventForm(self.data)
