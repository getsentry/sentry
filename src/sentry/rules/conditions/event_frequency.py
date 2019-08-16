from __future__ import absolute_import

from datetime import timedelta
from django import forms
from django.utils import timezone

from sentry import tsdb
from sentry.rules.conditions.base import EventCondition

intervals = {
    "1m": ("one minute", timedelta(minutes=1)),
    "1h": ("one hour", timedelta(hours=1)),
    "1d": ("one day", timedelta(hours=24)),
    "1w": ("one week", timedelta(days=7)),
    "30d": ("30 days", timedelta(days=30)),
}


class EventFrequencyForm(forms.Form):
    interval = forms.ChoiceField(
        choices=[
            (key, label)
            for key, (label, duration) in sorted(
                intervals.items(), key=lambda key____label__duration: key____label__duration[1][1]
            )
        ]
    )
    value = forms.IntegerField(widget=forms.TextInput())


class BaseEventFrequencyCondition(EventCondition):
    form_cls = EventFrequencyForm
    form_fields = {
        "value": {"type": "number", "placeholder": 100},
        "interval": {
            "type": "choice",
            "choices": [
                (key, label)
                for key, (label, duration) in sorted(
                    intervals.items(),
                    key=lambda key____label__duration: key____label__duration[1][1],
                )
            ],
        },
    }

    label = NotImplemented  # subclass must implement

    def __init__(self, *args, **kwargs):
        self.tsdb = kwargs.pop("tsdb", tsdb)

        super(BaseEventFrequencyCondition, self).__init__(*args, **kwargs)

    def passes(self, event, state):
        interval = self.get_option("interval")
        try:
            value = int(self.get_option("value"))
        except (TypeError, ValueError):
            return False

        if not interval:
            return False

        current_value = self.get_rate(event, interval, self.rule.environment_id)

        return current_value > value

    def query(self, event, start, end, environment_id):
        """
        """
        raise NotImplementedError  # subclass must implement

    def get_rate(self, event, interval, environment_id):
        _, duration = intervals[interval]
        end = timezone.now()
        return self.query(event, end - duration, end, environment_id=environment_id)


class EventFrequencyCondition(BaseEventFrequencyCondition):
    label = "An issue is seen more than {value} times in {interval}"

    def query(self, event, start, end, environment_id):
        return self.tsdb.get_sums(
            model=self.tsdb.models.group,
            keys=[event.group_id],
            start=start,
            end=end,
            environment_id=environment_id,
        )[event.group_id]


class EventUniqueUserFrequencyCondition(BaseEventFrequencyCondition):
    label = "An issue is seen by more than {value} users in {interval}"

    def query(self, event, start, end, environment_id):
        return self.tsdb.get_distinct_counts_totals(
            model=self.tsdb.models.users_affected_by_group,
            keys=[event.group_id],
            start=start,
            end=end,
            environment_id=environment_id,
        )[event.group_id]
