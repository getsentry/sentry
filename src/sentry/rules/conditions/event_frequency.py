from __future__ import absolute_import

import re

from datetime import timedelta
from django import forms
from django.utils import timezone

from sentry import tsdb
from sentry.receivers.rules import DEFAULT_RULE_LABEL
from sentry.rules.conditions.base import EventCondition
from sentry.utils import metrics

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
        query_result = self.query_hook(event, start, end, environment_id)
        metrics.incr(
            "rules.conditions.queried_snuba",
            tags={
                "condition": re.sub("(?!^)([A-Z]+)", r"_\1", self.__class__.__name__).lower(),
                "is_created_on_project_creation": self.is_guessed_to_be_created_on_project_creation,
            },
        )
        return query_result

    def query_hook(self, event, start, end, environment_id):
        """
        """
        raise NotImplementedError  # subclass must implement

    def get_rate(self, event, interval, environment_id):
        _, duration = intervals[interval]
        end = timezone.now()
        return self.query(event, end - duration, end, environment_id=environment_id)

    @property
    def is_guessed_to_be_created_on_project_creation(self):
        """
        Best effort approximation on whether a rule with this condition was created on project creation based on how
        closely the rule and project are created; and if the label matches the default name used on project creation.
        :return:
            bool: True if rule is approximated to be created on project creation, False otherwise.
        """
        delta = abs(self.rule.date_added - self.project.date_added)
        return delta.total_seconds() < 30 and self.rule.label == DEFAULT_RULE_LABEL


class EventFrequencyCondition(BaseEventFrequencyCondition):
    label = "The issue is seen more than {value} times in {interval}"

    def query_hook(self, event, start, end, environment_id):
        return self.tsdb.get_sums(
            model=self.tsdb.models.group,
            keys=[event.group_id],
            start=start,
            end=end,
            environment_id=environment_id,
        )[event.group_id]


class EventUniqueUserFrequencyCondition(BaseEventFrequencyCondition):
    label = "The issue is seen by more than {value} users in {interval}"

    def query_hook(self, event, start, end, environment_id):
        return self.tsdb.get_distinct_counts_totals(
            model=self.tsdb.models.users_affected_by_group,
            keys=[event.group_id],
            start=start,
            end=end,
            environment_id=environment_id,
        )[event.group_id]
