from __future__ import annotations

import abc
import contextlib
import logging
from collections import defaultdict
from collections.abc import Callable, Mapping
from datetime import datetime, timedelta
from typing import Any, Literal, NotRequired

from django import forms
from django.core.cache import cache
from django.db.models.enums import TextChoices
from django.utils import timezone

from sentry import release_health, tsdb
from sentry.eventstore.models import GroupEvent
from sentry.issues.constants import get_issue_tsdb_group_model, get_issue_tsdb_user_group_model
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition, GenericCondition
from sentry.tsdb.base import TSDBModel
from sentry.types.condition_activity import (
    FREQUENCY_CONDITION_BUCKET_SIZE,
    ConditionActivity,
    round_to_five_minute,
)
from sentry.utils import metrics
from sentry.utils.iterators import chunked
from sentry.utils.snuba import RateLimitExceeded, options_override

STANDARD_INTERVALS: dict[str, tuple[str, timedelta]] = {
    "1m": ("one minute", timedelta(minutes=1)),
    "5m": ("5 minutes", timedelta(minutes=5)),
    "15m": ("15 minutes", timedelta(minutes=15)),
    "1h": ("one hour", timedelta(hours=1)),
    "1d": ("one day", timedelta(hours=24)),
    "1w": ("one week", timedelta(days=7)),
    "30d": ("30 days", timedelta(days=30)),
}
COMPARISON_INTERVALS: dict[str, tuple[str, timedelta]] = {
    "5m": ("5 minutes", timedelta(minutes=5)),
    "15m": ("15 minutes", timedelta(minutes=15)),
    "1h": ("one hour", timedelta(hours=1)),
    "1d": ("one day", timedelta(hours=24)),
    "1w": ("one week", timedelta(days=7)),
    "30d": ("30 days", timedelta(days=30)),
}
SNUBA_LIMIT = 10000


class ComparisonType(TextChoices):
    COUNT = "count"
    PERCENT = "percent"


class EventFrequencyConditionData(GenericCondition):
    """
    The base typed dict for all condition data representing EventFrequency issue
    alert rule conditions
    """

    # Either the count or percentage.
    value: int
    # The interval to compare the value against such as 5m, 1h, 3w, etc.
    # e.g. # of issues is more than {value} in {interval}.
    interval: str
    # NOTE: Some of tne earliest COUNT conditions were created without the
    # comparisonType field, although modern rules will always have it.
    comparisonType: NotRequired[Literal[ComparisonType.COUNT, ComparisonType.PERCENT]]
    # The previous interval to compare the curr interval against. This is only
    # present in PERCENT conditions.
    # e.g. # of issues is 50% higher in {interval} compared to {comparisonInterval}
    comparisonInterval: NotRequired[str]


class EventFrequencyForm(forms.Form):
    intervals = STANDARD_INTERVALS
    interval = forms.ChoiceField(
        choices=[
            (key, label)
            for key, (label, _) in sorted(
                intervals.items(), key=lambda key____label__duration: key____label__duration[1][1]
            )
        ]
    )
    value = forms.IntegerField(widget=forms.TextInput())
    comparisonType = forms.ChoiceField(
        choices=ComparisonType,
        required=False,
    )
    comparisonInterval = forms.ChoiceField(
        choices=[
            (key, label)
            for key, (label, _) in sorted(COMPARISON_INTERVALS.items(), key=lambda item: item[1][1])
        ],
        required=False,
    )

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()
        if cleaned_data is None:
            return None

        # Don't store an empty string here if the value isn't passed
        if cleaned_data.get("comparisonInterval") == "":
            del cleaned_data["comparisonInterval"]
        cleaned_data["comparisonType"] = cleaned_data.get("comparisonType") or ComparisonType.COUNT
        if cleaned_data["comparisonType"] == ComparisonType.PERCENT and not cleaned_data.get(
            "comparisonInterval"
        ):
            msg = forms.ValidationError("comparisonInterval is required when comparing by percent")
            self.add_error("comparisonInterval", msg)
            return None
        return cleaned_data


class BaseEventFrequencyCondition(EventCondition, abc.ABC):
    intervals = STANDARD_INTERVALS
    form_cls = EventFrequencyForm

    def __init__(
        self,
        # Data specifically takes on this typeddict form for the
        # Event Frequency condition classes.
        data: EventFrequencyConditionData | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> None:
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
        kwargs["data"] = data

        super().__init__(*args, **kwargs)

    def _get_options(self) -> tuple[str | None, float | None]:
        interval, value = None, None
        try:
            interval = self.get_option("interval")
            value = float(self.get_option("value"))
        except (TypeError, ValueError):
            pass
        return interval, value

    def passes(self, event: GroupEvent, state: EventState) -> bool:
        interval, value = self._get_options()
        if not (interval and value is not None):
            return False

        # Assumes that the first event in a group will always be below the threshold.
        if state.is_new and value > 1:
            return False

        comparison_type = self.get_option("comparisonType", ComparisonType.COUNT)
        comparison_interval_option = self.get_option("comparisonInterval", "5m")
        comparison_interval = COMPARISON_INTERVALS[comparison_interval_option][1]
        _, duration = self.intervals[interval]
        try:
            current_value = self.get_rate(duration=duration, comparison_interval=comparison_interval, event=event, environment_id=self.rule.environment_id, comparison_type=comparison_type)  # type: ignore[arg-type, union-attr]
        # XXX(CEO): once inc-666 work is concluded, rm try/except
        except RateLimitExceeded:
            metrics.incr("rule.event_frequency.snuba_query_limit")
            return False

        logging.info("event_frequency_rule current: %s, threshold: %s", current_value, value)
        return current_value > value

    def passes_activity_frequency(
        self, activity: ConditionActivity, buckets: dict[datetime, int]
    ) -> bool:
        interval, value = self._get_options()
        if not (interval and value is not None):
            return False
        interval_delta = self.intervals[interval][1]
        comparison_type = self.get_option("comparisonType", ComparisonType.COUNT)

        # extrapolate if interval less than bucket size
        # if comparing percent increase, both intervals will be increased, so do not extrapolate value
        if interval_delta < FREQUENCY_CONDITION_BUCKET_SIZE:
            if comparison_type != ComparisonType.PERCENT:
                value *= int(FREQUENCY_CONDITION_BUCKET_SIZE / interval_delta)
            interval_delta = FREQUENCY_CONDITION_BUCKET_SIZE

        result = bucket_count(activity.timestamp - interval_delta, activity.timestamp, buckets)

        if comparison_type == ComparisonType.PERCENT:
            comparison_interval = COMPARISON_INTERVALS[self.get_option("comparisonInterval")][1]
            comparison_end = activity.timestamp - comparison_interval

            comparison_result = bucket_count(
                comparison_end - interval_delta, comparison_end, buckets
            )
            result = percent_increase(result, comparison_result)

        return result > value

    def get_preview_aggregate(self) -> tuple[str, str]:
        raise NotImplementedError

    def query(self, event: GroupEvent, start: datetime, end: datetime, environment_id: int) -> int:
        """
        Queries Snuba for a unique condition for a single group.
        """
        return self.query_hook(event, start, end, environment_id)

    def query_hook(
        self, event: GroupEvent, start: datetime, end: datetime, environment_id: int
    ) -> int:
        """
        Abstract method that specifies how to query Snuba for a single group
        depending on the condition. Must be implemented by subclasses.
        """
        raise NotImplementedError

    def batch_query(
        self, group_ids: set[int], start: datetime, end: datetime, environment_id: int
    ) -> dict[int, int]:
        """
        Queries Snuba for a unique condition for multiple groups.
        """
        return self.batch_query_hook(group_ids, start, end, environment_id)

    def batch_query_hook(
        self, group_ids: set[int], start: datetime, end: datetime, environment_id: int
    ) -> dict[int, int]:
        """
        Abstract method that specifies how to query Snuba for multiple groups
        depending on the condition. Must be implemented by subclasses.
        """
        raise NotImplementedError

    def disable_consistent_snuba_mode(
        self, duration: timedelta
    ) -> contextlib.AbstractContextManager[object]:
        """For conditions with interval >= 1 hour we don't need to worry about read your writes
        consistency. Disable it so that we can scale to more nodes.
        """
        option_override_cm: contextlib.AbstractContextManager[object] = contextlib.nullcontext()
        if duration >= timedelta(hours=1):
            option_override_cm = options_override({"consistent": False})
        return option_override_cm

    def get_comparison_start_end(
        self, interval: timedelta, duration: timedelta
    ) -> tuple[datetime, datetime]:
        """
        Calculate the start and end times for the query. `interval` is only used for EventFrequencyPercentCondition
        as the '5 minutes' in The issue affects more than 100 percent of sessions in 5 minutes, otherwise it's the current time.
        `duration` is the time frame in which the condition is measuring counts, e.g. the '10 minutes' in
        "The issue is seen more than 100 times in 10 minutes"
        """
        end = timezone.now() - interval
        start = end - duration
        return (start, end)

    def get_rate(
        self,
        duration: timedelta,
        comparison_interval: timedelta,
        event: GroupEvent,
        environment_id: int,
        comparison_type: str,
    ) -> int:
        start, end = self.get_comparison_start_end(timedelta(), duration)
        with self.disable_consistent_snuba_mode(duration):
            result = self.query(event, start, end, environment_id=environment_id)
            if comparison_type == ComparisonType.PERCENT:
                # TODO: Figure out if there's a way we can do this less frequently. All queries are
                # automatically cached for 10s. We could consider trying to cache this and the main
                # query for 20s to reduce the load.
                start, end = self.get_comparison_start_end(comparison_interval, duration)
                comparison_result = self.query(event, start, end, environment_id=environment_id)
                result = percent_increase(result, comparison_result)

        return result

    def get_rate_bulk(
        self,
        duration: timedelta,
        comparison_interval: timedelta,
        group_ids: set[int],
        environment_id: int,
        comparison_type: str,
    ) -> dict[int, int]:
        start, end = self.get_comparison_start_end(timedelta(), duration)
        with self.disable_consistent_snuba_mode(duration):
            result = self.batch_query(
                group_ids=group_ids,
                start=start,
                end=end,
                environment_id=environment_id,
            )
        if comparison_type == ComparisonType.PERCENT:
            start, comparison_end = self.get_comparison_start_end(comparison_interval, duration)
            comparison_result = self.batch_query(
                group_ids=group_ids,
                start=start,
                end=comparison_end,
                environment_id=environment_id,
            )
            result = {
                group_id: percent_increase(result[group_id], comparison_result[group_id])
                for group_id in group_ids
            }
        return result

    def get_snuba_query_result(
        self,
        tsdb_function: Callable[..., Any],
        keys: list[int],
        group: Group,
        model: TSDBModel,
        start: datetime,
        end: datetime,
        environment_id: int,
        referrer_suffix: str,
    ) -> Mapping[int, int]:
        result: Mapping[int, int] = tsdb_function(
            model=model,
            keys=keys,
            start=start,
            end=end,
            environment_id=environment_id,
            use_cache=True,
            jitter_value=group.id,
            tenant_ids={"organization_id": group.project.organization_id},
            referrer_suffix=referrer_suffix,
        )
        return result

    def get_chunked_result(
        self,
        tsdb_function: Callable[..., Any],
        model: TSDBModel,
        groups: list[Group],
        start: datetime,
        end: datetime,
        environment_id: int,
        referrer_suffix: str,
    ) -> dict[int, int]:
        batch_totals: dict[int, int] = defaultdict(int)
        group = groups[0]
        for group_chunk in chunked(groups, SNUBA_LIMIT):
            result = self.get_snuba_query_result(
                tsdb_function=tsdb_function,
                model=model,
                keys=[group.id for group in group_chunk],
                group=group,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix=referrer_suffix,
            )
            batch_totals.update(result)
        return batch_totals


class EventFrequencyCondition(BaseEventFrequencyCondition):
    id = "sentry.rules.conditions.event_frequency.EventFrequencyCondition"
    label = "The issue is seen more than {value} times in {interval}"

    def query_hook(
        self, event: GroupEvent, start: datetime, end: datetime, environment_id: int
    ) -> int:
        sums: Mapping[int, int] = self.get_snuba_query_result(
            tsdb_function=self.tsdb.get_sums,
            keys=[event.group_id],
            group=event.group,
            model=get_issue_tsdb_group_model(event.group.issue_category),
            start=start,
            end=end,
            environment_id=environment_id,
            referrer_suffix="alert_event_frequency",
        )
        return sums[event.group_id]

    def batch_query_hook(
        self, group_ids: set[int], start: datetime, end: datetime, environment_id: int
    ) -> dict[int, int]:
        batch_sums: dict[int, int] = defaultdict(int)
        groups = Group.objects.filter(id__in=group_ids)
        error_issues = [group for group in groups if group.issue_category == GroupCategory.ERROR]
        generic_issues = [group for group in groups if group.issue_category != GroupCategory.ERROR]

        if error_issues:
            error_sums = self.get_chunked_result(
                tsdb_function=self.tsdb.get_sums,
                model=get_issue_tsdb_group_model(error_issues[0].issue_category),
                groups=error_issues,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="alert_event_frequency",
            )
            batch_sums.update(error_sums)

        if generic_issues:
            generic_sums = self.get_chunked_result(
                tsdb_function=self.tsdb.get_sums,
                model=get_issue_tsdb_group_model(generic_issues[0].issue_category),
                groups=generic_issues,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="alert_event_frequency",
            )
            batch_sums.update(generic_sums)

        return batch_sums

    def get_preview_aggregate(self) -> tuple[str, str]:
        return "count", "roundedTime"


class EventUniqueUserFrequencyCondition(BaseEventFrequencyCondition):
    id = "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition"
    label = "The issue is seen by more than {value} users in {interval}"

    def query_hook(
        self, event: GroupEvent, start: datetime, end: datetime, environment_id: int
    ) -> int:
        totals: Mapping[int, int] = self.get_snuba_query_result(
            tsdb_function=self.tsdb.get_distinct_counts_totals,
            keys=[event.group_id],
            group=event.group,
            model=get_issue_tsdb_user_group_model(event.group.issue_category),
            start=start,
            end=end,
            environment_id=environment_id,
            referrer_suffix="alert_event_uniq_user_frequency",
        )
        return totals[event.group_id]

    def batch_query_hook(
        self, group_ids: set[int], start: datetime, end: datetime, environment_id: int
    ) -> dict[int, int]:
        batch_totals: dict[int, int] = defaultdict(int)
        groups = Group.objects.filter(id__in=group_ids)
        error_issues = [group for group in groups if group.issue_category == GroupCategory.ERROR]
        generic_issues = [group for group in groups if group.issue_category != GroupCategory.ERROR]

        if error_issues:
            error_totals = self.get_chunked_result(
                tsdb_function=self.tsdb.get_distinct_counts_totals,
                model=get_issue_tsdb_user_group_model(error_issues[0].issue_category),
                groups=error_issues,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="alert_event_uniq_user_frequency",
            )
            batch_totals.update(error_totals)

        if generic_issues:
            generic_totals = self.get_chunked_result(
                tsdb_function=self.tsdb.get_distinct_counts_totals,
                model=get_issue_tsdb_user_group_model(generic_issues[0].issue_category),
                groups=generic_issues,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="alert_event_uniq_user_frequency",
            )
            batch_totals.update(generic_totals)

        return batch_totals

    def get_preview_aggregate(self) -> tuple[str, str]:
        return "uniq", "user"


PERCENT_INTERVALS: dict[str, tuple[str, timedelta]] = {
    "1m": ("1 minute", timedelta(minutes=1)),
    "5m": ("5 minutes", timedelta(minutes=5)),
    "10m": ("10 minutes", timedelta(minutes=10)),
    "30m": ("30 minutes", timedelta(minutes=30)),
    "1h": ("1 hour", timedelta(minutes=60)),
}

PERCENT_INTERVALS_TO_DISPLAY: dict[str, tuple[str, timedelta]] = {
    "5m": ("5 minutes", timedelta(minutes=5)),
    "10m": ("10 minutes", timedelta(minutes=10)),
    "30m": ("30 minutes", timedelta(minutes=30)),
    "1h": ("1 hour", timedelta(minutes=60)),
}
MIN_SESSIONS_TO_FIRE = 50


class EventFrequencyPercentForm(EventFrequencyForm):
    intervals = PERCENT_INTERVALS_TO_DISPLAY
    interval = forms.ChoiceField(
        choices=[
            (key, label)
            for key, (label, duration) in sorted(
                PERCENT_INTERVALS_TO_DISPLAY.items(),
                key=lambda key____label__duration: key____label__duration[1][1],
            )
        ]
    )
    value = forms.FloatField(widget=forms.TextInput(), min_value=0)

    def clean(self) -> dict[str, Any] | None:
        cleaned_data = super().clean()
        if (
            cleaned_data
            and cleaned_data["comparisonType"] == ComparisonType.COUNT
            and cleaned_data.get("value", 0) > 100
        ):
            self.add_error(
                "value", forms.ValidationError("Ensure this value is less than or equal to 100")
            )
            return None

        return cleaned_data


class EventFrequencyPercentCondition(BaseEventFrequencyCondition):
    id = "sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition"
    label = "The issue affects more than {value} percent of sessions in {interval}"
    logger = logging.getLogger("sentry.rules.event_frequency")

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.intervals = PERCENT_INTERVALS
        self.form_cls = EventFrequencyPercentForm
        super().__init__(*args, **kwargs)

        # Override form fields interval to hide 1 min option from ui, but leave
        # it available to process existing 1m rules.
        self.form_fields["interval"] = {
            "type": "choice",
            "choices": [
                (key, label)
                for key, (label, duration) in sorted(
                    PERCENT_INTERVALS_TO_DISPLAY.items(),
                    key=lambda key____label__duration: key____label__duration[1][1],
                )
            ],
        }

    def get_session_count(
        self, project_id: int, environment_id: int, start: datetime, end: datetime
    ) -> int:
        cache_key = f"r.c.spc:{project_id}-{environment_id}"
        session_count_last_hour = cache.get(cache_key)
        if session_count_last_hour is None:
            with options_override({"consistent": False}):
                session_count_last_hour = release_health.backend.get_project_sessions_count(
                    project_id=project_id,
                    environment_id=environment_id,
                    rollup=60,
                    start=end - timedelta(minutes=60),
                    end=end,
                )

            cache.set(cache_key, session_count_last_hour, 600)
        return session_count_last_hour

    def get_session_interval(self, session_count: int, interval: str) -> int | None:
        if session_count >= MIN_SESSIONS_TO_FIRE:
            interval_in_minutes = PERCENT_INTERVALS[interval][1].total_seconds() // 60
            return int(session_count / (60 / interval_in_minutes))
        return None

    def query_hook(
        self, event: GroupEvent, start: datetime, end: datetime, environment_id: int
    ) -> int:
        project_id = event.project_id
        session_count_last_hour = self.get_session_count(project_id, environment_id, start, end)
        avg_sessions_in_interval = self.get_session_interval(
            session_count_last_hour, self.get_option("interval")
        )
        if avg_sessions_in_interval:
            issue_count = self.get_snuba_query_result(
                tsdb_function=self.tsdb.get_sums,
                keys=[event.group_id],
                group=event.group,
                model=get_issue_tsdb_group_model(event.group.issue_category),
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="alert_event_frequency_percent",
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
            percent: int = int(100 * round(issue_count / avg_sessions_in_interval, 4))
            return percent

        return 0

    def batch_query_hook(
        self, group_ids: set[int], start: datetime, end: datetime, environment_id: int
    ) -> dict[int, int]:
        batch_percents: dict[int, int] = defaultdict(int)
        groups = Group.objects.filter(id__in=group_ids)
        project_id = groups[0].project.id
        session_count_last_hour = self.get_session_count(project_id, environment_id, start, end)
        avg_sessions_in_interval = self.get_session_interval(
            session_count_last_hour, self.get_option("interval")
        )
        if avg_sessions_in_interval:
            error_issues = [
                group for group in groups if group.issue_category == GroupCategory.ERROR
            ]
            if error_issues:
                error_issue_count = self.get_chunked_result(
                    tsdb_function=self.tsdb.get_sums,
                    model=get_issue_tsdb_group_model(error_issues[0].issue_category),
                    groups=error_issues,
                    start=start,
                    end=end,
                    environment_id=environment_id,
                    referrer_suffix="alert_event_frequency_percent",
                )
                for group_id, count in error_issue_count.items():
                    percent: int = int(100 * round(count / avg_sessions_in_interval, 4))
                    batch_percents[group_id] = percent
        else:
            percent = 0
            for group in groups:
                batch_percents[group.id] = percent

        return batch_percents

    def passes_activity_frequency(
        self, activity: ConditionActivity, buckets: dict[datetime, int]
    ) -> bool:
        raise NotImplementedError


def bucket_count(start: datetime, end: datetime, buckets: dict[datetime, int]) -> int:
    rounded_end = round_to_five_minute(end)
    rounded_start = round_to_five_minute(start)
    count = buckets.get(rounded_end, 0) - buckets.get(rounded_start, 0)
    return count


def percent_increase(result: int, comparison_result: int) -> int:
    return (
        int(max(0, ((result - comparison_result) / comparison_result * 100)))
        if comparison_result > 0
        else 0
    )
