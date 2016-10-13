"""
sentry.rules.conditions.event_frequency
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from datetime import timedelta
from django import forms

from django.utils import timezone
from sentry.rules.conditions.base import EventCondition


class Interval(object):
    ONE_MINUTE = '1m'
    ONE_HOUR = '1h'
    ONE_DAY = '1d'


class EventFrequencyForm(forms.Form):
    interval = forms.ChoiceField(choices=(
        (Interval.ONE_MINUTE, 'one minute'),
        (Interval.ONE_HOUR, 'one hour'),
        (Interval.ONE_DAY, 'one day'),
    ))
    value = forms.IntegerField(widget=forms.TextInput(attrs={
        'placeholder': '100',
        'type': 'number'
    }))


class BaseEventFrequencyCondition(EventCondition):
    form_cls = EventFrequencyForm
    label = NotImplemented  # subclass must implement

    def __init__(self, *args, **kwargs):
        from sentry.app import tsdb

        self.tsdb = kwargs.pop('tsdb', tsdb)

        super(BaseEventFrequencyCondition, self).__init__(*args, **kwargs)

    def passes(self, event, state):
        interval = self.get_option('interval')
        try:
            value = int(self.get_option('value'))
        except (TypeError, ValueError):
            return False

        if not interval:
            return False

        current_value = self.get_rate(event, interval)

        return current_value > value

    def query(self, event, start, end):
        """
        """
        raise NotImplementedError  # subclass must implement

    def get_rate(self, event, interval):
        end = timezone.now()
        if interval == Interval.ONE_MINUTE:
            start = end - timedelta(minutes=1)
        elif interval == Interval.ONE_HOUR:
            start = end - timedelta(hours=1)
        elif interval == Interval.ONE_DAY:
            start = end - timedelta(hours=24)
        else:
            raise ValueError(interval)

        return self.query(
            event,
            start,
            end,
        )


class EventFrequencyCondition(BaseEventFrequencyCondition):
    label = 'An event is seen more than {value} times in {interval}'

    def query(self, event, start, end):
        return self.tsdb.get_sums(
            model=self.tsdb.models.group,
            keys=[event.group_id],
            start=start,
            end=end,
        )[event.group_id]


class EventUniqueUserFrequencyCondition(BaseEventFrequencyCondition):
    label = 'An event is seen by more than {value} users in {interval}'

    def query(self, event, start, end):
        return self.tsdb.get_distinct_counts_totals(
            model=self.tsdb.models.users_affected_by_group,
            keys=[event.group_id],
            start=start,
            end=end,
        )[event.group_id]
