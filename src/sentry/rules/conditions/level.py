from collections import OrderedDict
from typing import Callable, Tuple

from django import forms

from sentry.constants import LOG_LEVELS, LOG_LEVELS_MAP
from sentry.rules import LEVEL_MATCH_CHOICES as MATCH_CHOICES
from sentry.rules import MatchType
from sentry.rules.conditions.base import EventCondition

key: Callable[[Tuple[str, str]], str] = lambda x: x[0]
LEVEL_CHOICES = OrderedDict(
    [(f"{k}", v) for k, v in sorted(LOG_LEVELS.items(), key=key, reverse=True)]
)


class LevelEventForm(forms.Form):
    level = forms.ChoiceField(choices=list(LEVEL_CHOICES.items()))
    match = forms.ChoiceField(choices=list(MATCH_CHOICES.items()))


class LevelCondition(EventCondition):
    form_cls = LevelEventForm
    label = "The event's level is {match} {level}"
    form_fields = {
        "level": {"type": "choice", "choices": list(LEVEL_CHOICES.items())},
        "match": {"type": "choice", "choices": list(MATCH_CHOICES.items())},
    }

    def passes(self, event, state, **kwargs):
        desired_level = self.get_option("level")
        desired_match = self.get_option("match")

        if not (desired_level and desired_match):
            return False

        desired_level = int(desired_level)
        # Fetch the event level from the tags since event.level is
        # event.group.level which may have changed
        try:
            level = LOG_LEVELS_MAP[event.get_tag("level")]
        except KeyError:
            return False

        if desired_match == MatchType.EQUAL:
            return level == desired_level
        elif desired_match == MatchType.GREATER_OR_EQUAL:
            return level >= desired_level
        elif desired_match == MatchType.LESS_OR_EQUAL:
            return level <= desired_level
        return False

    def render_label(self):
        data = {
            "level": LEVEL_CHOICES[self.data["level"]],
            "match": MATCH_CHOICES[self.data["match"]],
        }
        return self.label.format(**data)
