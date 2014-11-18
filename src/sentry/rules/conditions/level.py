"""
sentry.rules.conditions.minimum_level
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django import forms
from sentry.constants import LOG_LEVELS

from sentry.rules.conditions.base import EventCondition


class LevelMatchType(object):
    EQUAL = 'eq'
    LESS_THAN = 'lt'
    GREATER_THAN = 'gt'


class LevelEventForm(forms.Form):
    level = forms.ChoiceField(
        choices=[("{0}".format(k), "{0}".format(v.capitalize())) for k, v in LOG_LEVELS.items()],
        initial=30)
    match = forms.ChoiceField(
        choices=(
            (LevelMatchType.EQUAL, 'equals'),
            (LevelMatchType.LESS_THAN, 'less than'),
            (LevelMatchType.GREATER_THAN, 'greater than')),
        initial="gt")


class LevelCondition(EventCondition):
    form_cls = LevelEventForm
    label = 'An event matching {match} {level}'

    def passes(self, event, state, **kwargs):
        desired_level = self.get_option('level')
        desired_match = self.get_option('match')

        if not (desired_level and desired_match):
            return False

        desired_level = int(desired_level)
        level = int(event.level)

        if desired_match == LevelMatchType.EQUAL:
            return level == desired_level
        elif desired_match == LevelMatchType.GREATER_THAN:
            return level > desired_level
        elif desired_match == LevelMatchType.GREATER_THAN_EQUAL:
            return level >= desired_level
        elif desired_match == LevelMatchType.LESS_THAN:
            return level < desired_level
        elif desired_match == LevelMatchType.LESS_THAN_EQUAL:
            return level <= desired_level
        return False
