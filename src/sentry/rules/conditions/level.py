"""
sentry.rules.conditions.minimum_level
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from collections import OrderedDict

from django import forms
from sentry.constants import LOG_LEVELS

from sentry.rules.conditions.base import EventCondition

LEVEL_CHOICES = OrderedDict([
    ("{0}".format(k), "{0}".format(v.capitalize()))
    for k, v in sorted(LOG_LEVELS.items(), key=lambda x: x[0], reverse=True)
])


class LevelMatchType(object):
    EQUAL = 'eq'
    LESS_OR_EQUAL = 'lte'
    GREATER_OR_EQUAL = 'gte'


class LevelEventForm(forms.Form):
    level = forms.ChoiceField(
        choices=LEVEL_CHOICES.items(),
        initial=30)
    match = forms.ChoiceField(
        choices=(
            (LevelMatchType.EQUAL, 'equal'),
            (LevelMatchType.LESS_OR_EQUAL, 'less than or equal to'),
            (LevelMatchType.GREATER_OR_EQUAL, 'greater than or equal to')),
        initial=LevelMatchType.GREATER_OR_EQUAL)


class LevelCondition(EventCondition):
    form_cls = LevelEventForm
    label = 'An event\'s level is {match} {level}'

    def render_label(self):
        data = {
            'match': self.data['match'],
            'level': LEVEL_CHOICES[self.data['level']],
        }
        return self.label.format(**data)

    def passes(self, event, state, **kwargs):
        desired_level = self.get_option('level')
        desired_match = self.get_option('match')

        if not (desired_level and desired_match):
            return False

        desired_level = int(desired_level)
        level = int(event.level)

        if desired_match == LevelMatchType.EQUAL:
            return level == desired_level
        elif desired_match == LevelMatchType.GREATER_OR_EQUAL:
            return level >= desired_level
        elif desired_match == LevelMatchType.LESS_OR_EQUAL:
            return level <= desired_level
        return False
