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


intervals = {
    '1m': ('one minute', timedelta(minutes=1)),
    '1h': ('one hour', timedelta(hours=1)),
    '1d': ('one day', timedelta(hours=24)),
    '1w': ('one week', timedelta(days=7)),
    '30d': ('30 days', timedelta(days=30)),
}


class EventFrequencyForm(forms.Form):
    interval = forms.ChoiceField(choices=[
        (key, label) for key, (label, duration) in sorted(
            intervals.items(),
            key=lambda (key, (label, duration)): duration
        )
    ])
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
        _, duration = intervals[interval]
        end = timezone.now()
        return self.query(
            event,
            end - duration,
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
