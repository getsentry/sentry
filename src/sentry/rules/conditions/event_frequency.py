import re
from datetime import timedelta

from django import forms
from django.core.cache import cache
from django.utils import timezone

from sentry import tsdb
from sentry.receivers.rules import DEFAULT_RULE_LABEL
from sentry.rules.conditions.base import EventCondition
from sentry.utils import metrics
from sentry.utils.snuba import Dataset, raw_query

standard_intervals = {
    "1m": ("one minute", timedelta(minutes=1)),
    "5m": ("5 minutes", timedelta(minutes=5)),
    "15m": ("15 minutes", timedelta(minutes=15)),
    "1h": ("one hour", timedelta(hours=1)),
    "1d": ("one day", timedelta(hours=24)),
    "1w": ("one week", timedelta(days=7)),
    "30d": ("30 days", timedelta(days=30)),
}


class EventFrequencyForm(forms.Form):
    intervals = standard_intervals
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
    intervals = standard_intervals
    form_cls = EventFrequencyForm
    label = NotImplemented  # subclass must implement

    def __init__(self, *args, **kwargs):
        self.tsdb = kwargs.pop("tsdb", tsdb)
        self.form_fields = {
            "value": {"type": "number", "placeholder": 100},
            "interval": {
                "type": "choice",
                "choices": [
                    (key, label)
                    for key, (label, duration) in sorted(
                        self.intervals.items(),
                        key=lambda key____label__duration: key____label__duration[1][1],
                    )
                ],
            },
        }

        super().__init__(*args, **kwargs)

    def passes(self, event, state):
        interval = self.get_option("interval")
        try:
            value = float(self.get_option("value"))
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
        """ """
        raise NotImplementedError  # subclass must implement

    def get_rate(self, event, interval, environment_id):
        _, duration = self.intervals[interval]
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
            use_cache=True,
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
            use_cache=True,
        )[event.group_id]


percent_intervals = {
    "1m": ("1 minute", timedelta(minutes=1)),
    "5m": ("5 minutes", timedelta(minutes=5)),
    "10m": ("10 minutes", timedelta(minutes=10)),
    "30m": ("30 minutes", timedelta(minutes=30)),
    "1h": ("1 hour", timedelta(minutes=60)),
}


class EventFrequencyPercentForm(EventFrequencyForm):
    intervals = percent_intervals
    interval = forms.ChoiceField(
        choices=[
            (key, label)
            for key, (label, duration) in sorted(
                percent_intervals.items(),
                key=lambda key____label__duration: key____label__duration[1][1],
            )
        ]
    )
    value = forms.FloatField(widget=forms.TextInput(), min_value=0, max_value=100)


class EventFrequencyPercentCondition(BaseEventFrequencyCondition):
    label = "The issue affects more than {value} percent of sessions in {interval}"

    def __init__(self, *args, **kwargs):
        self.intervals = percent_intervals
        self.form_cls = EventFrequencyPercentForm
        super().__init__(*args, **kwargs)

    def query_hook(self, event, start, end, environment_id):
        project_id = event.project_id
        cache_key = f"r.c.spc:{project_id}-{environment_id}"
        session_count_last_hour = cache.get(cache_key)
        if session_count_last_hour is None:
            filters = {"project_id": [project_id]}
            if environment_id:
                filters["environment"] = [environment_id]
            result_totals = raw_query(
                selected_columns=["sessions"],
                rollup=60,
                dataset=Dataset.Sessions,
                start=end - timedelta(minutes=60),
                end=end,
                filter_keys=filters,
                groupby=["bucketed_started"],
                referrer="rules.conditions.event_frequency.EventFrequencyPercentCondition",
            )
            if result_totals["data"]:
                session_count_last_hour = sum(
                    bucket["sessions"] for bucket in result_totals["data"]
                )
            else:
                session_count_last_hour = False
            cache.set(cache_key, session_count_last_hour, 600)

        if session_count_last_hour:
            interval_in_minutes = (
                percent_intervals[self.get_option("interval")][1].total_seconds() // 60
            )
            avg_sessions_in_interval = session_count_last_hour / (60 / interval_in_minutes)
            issue_count = self.tsdb.get_sums(
                model=self.tsdb.models.group,
                keys=[event.group_id],
                start=start,
                end=end,
                environment_id=environment_id,
                use_cache=True,
            )[event.group_id]
            return 100 * round(issue_count / avg_sessions_in_interval, 4)

        return 0
