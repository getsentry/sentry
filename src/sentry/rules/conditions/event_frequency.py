import logging
import re
from datetime import timedelta

from django import forms
from django.core.cache import cache
from django.utils import timezone

from sentry import release_health, tsdb
from sentry.receivers.rules import DEFAULT_RULE_LABEL
from sentry.rules.conditions.base import EventCondition
from sentry.utils import metrics
from sentry.utils.snuba import options_override

standard_intervals = {
    "1m": ("one minute", timedelta(minutes=1)),
    "5m": ("5 minutes", timedelta(minutes=5)),
    "15m": ("15 minutes", timedelta(minutes=15)),
    "1h": ("one hour", timedelta(hours=1)),
    "1d": ("one day", timedelta(hours=24)),
    "1w": ("one week", timedelta(days=7)),
    "30d": ("30 days", timedelta(days=30)),
}
comparison_intervals = {
    "5m": ("5 minutes", timedelta(minutes=5)),
    "15m": ("15 minutes", timedelta(minutes=15)),
    "1h": ("one hour", timedelta(hours=1)),
    "1d": ("one day", timedelta(hours=24)),
    "1w": ("one week", timedelta(days=7)),
    "30d": ("30 days", timedelta(days=30)),
}
COMPARISON_TYPE_COUNT = "count"
COMPARISON_TYPE_PERCENT = "percent"
comparison_types = {
    COMPARISON_TYPE_COUNT: COMPARISON_TYPE_COUNT,
    COMPARISON_TYPE_PERCENT: COMPARISON_TYPE_PERCENT,
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
    comparisonType = forms.ChoiceField(
        choices=list(sorted(comparison_types.items(), key=lambda item: item[1])),
        required=False,
    )
    comparisonInterval = forms.ChoiceField(
        choices=[
            (key, label)
            for key, (label, duration) in sorted(
                comparison_intervals.items(), key=lambda item: item[1][1]
            )
        ],
        required=False,
    )

    def clean(self):
        cleaned_data = super().clean()
        # Don't store an empty string here if the value isn't passed
        if cleaned_data.get("comparisonInterval") == "":
            del cleaned_data["comparisonInterval"]
        cleaned_data["comparisonType"] = cleaned_data.get("comparisonType") or COMPARISON_TYPE_COUNT
        if cleaned_data["comparisonType"] == COMPARISON_TYPE_PERCENT and not cleaned_data.get(
            "comparisonInterval"
        ):
            msg = forms.ValidationError("comparisonInterval is required when comparing by percent")
            self.add_error("comparisonInterval", msg)
            return


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
        result = self.query(event, end - duration, end, environment_id=environment_id)
        comparison_type = self.get_option("comparisonType", COMPARISON_TYPE_COUNT)
        if comparison_type == COMPARISON_TYPE_PERCENT:
            comparison_interval = comparison_intervals[self.get_option("comparisonInterval")][1]
            comparison_end = end - comparison_interval
            # TODO: Figure out if there's a way we can do this less frequently. All queries are
            # automatically cached for 10s. We could consider trying to cache this and the main
            # query for 20s to reduce the load.
            comparison_result = self.query(
                event, comparison_end - duration, comparison_end, environment_id=environment_id
            )
            result = (
                int(max(0, ((result / comparison_result) * 100) - 100))
                if comparison_result > 0
                else 0
            )

        return result

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

percent_intervals_to_display = {
    "5m": ("5 minutes", timedelta(minutes=5)),
    "10m": ("10 minutes", timedelta(minutes=10)),
    "30m": ("30 minutes", timedelta(minutes=30)),
    "1h": ("1 hour", timedelta(minutes=60)),
}
MIN_SESSIONS_TO_FIRE = 50


class EventFrequencyPercentForm(EventFrequencyForm):
    intervals = percent_intervals_to_display
    interval = forms.ChoiceField(
        choices=[
            (key, label)
            for key, (label, duration) in sorted(
                percent_intervals_to_display.items(),
                key=lambda key____label__duration: key____label__duration[1][1],
            )
        ]
    )
    value = forms.FloatField(widget=forms.TextInput(), min_value=0, max_value=100)


class EventFrequencyPercentCondition(BaseEventFrequencyCondition):
    label = "The issue affects more than {value} percent of sessions in {interval}"
    logger = logging.getLogger("rules.event_frequency")

    def __init__(self, *args, **kwargs):
        self.intervals = percent_intervals
        self.form_cls = EventFrequencyPercentForm
        super().__init__(*args, **kwargs)

        # Override form fields interval to hide 1 min option from ui, but leave it available to process existing 1m rules
        self.form_fields["interval"] = {
            "type": "choice",
            "choices": [
                (key, label)
                for key, (label, duration) in sorted(
                    percent_intervals_to_display.items(),
                    key=lambda key____label__duration: key____label__duration[1][1],
                )
            ],
        }

    def query_hook(self, event, start, end, environment_id):
        project_id = event.project_id
        cache_key = f"r.c.spc:{project_id}-{environment_id}"
        session_count_last_hour = cache.get(cache_key)
        if session_count_last_hour is None:
            with options_override({"consistent": False}):
                session_count_last_hour = release_health.get_project_sessions_count(
                    project_id=project_id,
                    environment_id=environment_id,
                    rollup=60,
                    start=end - timedelta(minutes=60),
                    end=end,
                )

            cache.set(cache_key, session_count_last_hour, 600)

        if session_count_last_hour >= MIN_SESSIONS_TO_FIRE:
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
            if issue_count > avg_sessions_in_interval:
                # We want to better understand when and why this is happening, so we're logging it for now
                self.logger.info(
                    "EventFrequencyPercentCondition.query_hook",
                    extra={
                        "issue_count": issue_count,
                        "project_id": project_id,
                        "avg_sessions_in_interval": avg_sessions_in_interval,
                    },
                )
            return 100 * round(issue_count / avg_sessions_in_interval, 4)

        return 0
