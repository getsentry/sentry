"""
sentry.rules.conditions.tagged_event
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django import forms

from sentry.rules.conditions.base import EventCondition


class MatchType(object):
    EQUAL = 'eq'
    NOT_EQUAL = 'ne'
    STARTS_WITH = 'sw'
    ENDS_WITH = 'ew'
    CONTAINS = 'co'
    NOT_CONTAINS = 'nc'


class TaggedEventForm(forms.Form):
    key = forms.CharField(widget=forms.TextInput(attrs={'placeholder': 'key'}))
    match = forms.ChoiceField(choices=(
        (MatchType.EQUAL, 'equals'),
        (MatchType.NOT_EQUAL, 'does not equal'),
        (MatchType.STARTS_WITH, 'starts with'),
        (MatchType.ENDS_WITH, 'ends with'),
        (MatchType.CONTAINS, 'contains'),
        (MatchType.NOT_CONTAINS, 'does not contain'),
    ))
    value = forms.CharField(widget=forms.TextInput(attrs={'placeholder': 'value'}))


class TaggedEventCondition(EventCondition):
    form_cls = TaggedEventForm
    label = 'An events tags match {key} {match} {value}'

    def passes(self, event, state, **kwargs):
        key = self.get_option('key')
        match = self.get_option('match')
        value = self.get_option('value')

        if not (key and match and value):
            return False

        value = value.lower()
        key = key.lower()

        tags = (v.lower() for k, v in event.get_tags() if k.lower() == key)

        if match == MatchType.EQUAL:
            for t_value in tags:
                if t_value == value:
                    return True
            return False

        elif match == MatchType.NOT_EQUAL:
            for t_value in tags:
                if t_value == value:
                    return False
            return True

        elif match == MatchType.STARTS_WITH:
            for t_value in tags:
                if t_value.startswith(value):
                    return True
            return False

        elif match == MatchType.ENDS_WITH:
            for t_value in tags:
                if t_value.endswith(value):
                    return True
            return False

        elif match == MatchType.CONTAINS:
            for t_value in tags:
                if value in t_value:
                    return True
            return False

        elif match == MatchType.NOT_CONTAINS:
            for t_value in tags:
                if value in t_value:
                    return False
            return True
