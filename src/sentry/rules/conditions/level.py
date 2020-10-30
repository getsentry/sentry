from __future__ import absolute_import

from collections import OrderedDict

from django import forms
from sentry.constants import LOG_LEVELS, LOG_LEVELS_MAP

from sentry.rules.conditions.base import EventCondition

LEVEL_CHOICES = OrderedDict(
    [(u"{0}".format(k), v) for k, v in sorted(LOG_LEVELS.items(), key=lambda x: x[0], reverse=True)]
)


class MatchType(object):
    EQUAL = "eq"
    LESS_OR_EQUAL = "lte"
    GREATER_OR_EQUAL = "gte"


MATCH_CHOICES = OrderedDict(
    [
        (MatchType.EQUAL, "equal to"),
        (MatchType.LESS_OR_EQUAL, "less than or equal to"),
        (MatchType.GREATER_OR_EQUAL, "greater than or equal to"),
    ]
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
