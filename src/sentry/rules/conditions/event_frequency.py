from __future__ import annotations

import abc
import contextlib
import logging
from collections import defaultdict
from collections.abc import Callable, Mapping
from datetime import datetime, timedelta
from typing import Any, Literal, NotRequired, TypedDict

from django import forms
from django.core.cache import cache
from django.db.models import QuerySet
from django.db.models.enums import TextChoices
from django.utils import timezone
from snuba_sdk import Op

from sentry import features, release_health, tsdb
from sentry.eventstore.models import GroupEvent
from sentry.issues.constants import get_issue_tsdb_group_model, get_issue_tsdb_user_group_model
from sentry.issues.grouptype import GroupCategory, get_group_type_by_type_id
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.rules import EventState
from sentry.rules.conditions.base import EventCondition, GenericCondition
from sentry.rules.match import MatchType
from sentry.tsdb.base import TSDBModel
from sentry.types.condition_activity import (
    FREQUENCY_CONDITION_BUCKET_SIZE,
    ConditionActivity,
    round_to_five_minute,
)
from sentry.utils.iterators import chunked
from sentry.utils.snuba import options_override

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


DEFAULT_COMPARISON_INTERVAL = "5m"


class ComparisonType(TextChoices):
    COUNT = "count"
    PERCENT = "percent"


class EventFrequencyConditionData(GenericCondition):
    """
    The base typed dict for all condition data representing EventFrequency issue
    alert rule conditions
    """

    # Either the count or percentage.
    value: int | float
    # The interval to compare the value against such as 5m, 1h, 3w, etc.
    # e.g. # of issues is more than {value} in {interval}.
    interval: str
    # NOTE: Some of the earliest COUNT conditions were created without the
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


class _QSTypedDict(TypedDict):
    id: int
    type: int
    project_id: int
    project__organization_id: int


class BaseEventFrequencyCondition(EventCondition, abc.ABC):
    intervals = STANDARD_INTERVALS

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
        comparison_interval_option = self.get_option(
            "comparisonInterval", DEFAULT_COMPARISON_INTERVAL
        )
        if comparison_interval_option == "":
            return False
        comparison_interval = COMPARISON_INTERVALS[comparison_interval_option][1]
        _, duration = self.intervals[interval]
        current_value = self.get_rate(duration=duration, comparison_interval=comparison_interval, event=event, environment_id=self.rule.environment_id, comparison_type=comparison_type)  # type: ignore[union-attr]

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

    def get_query_window(self, end: datetime, duration: timedelta) -> tuple[datetime, datetime]:
        """
        Calculate the start and end times for the query.
        "duration" is the length of the window we're querying over.
        """
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
        current_time = timezone.now()
        start, end = self.get_query_window(end=current_time, duration=duration)
        with self.disable_consistent_snuba_mode(duration):
            result = self.query(event, start, end, environment_id=environment_id)
            if comparison_type == ComparisonType.PERCENT:
                # TODO: Figure out if there's a way we can do this less frequently. All queries are
                # automatically cached for 10s. We could consider trying to cache this and the main
                # query for 20s to reduce the load.
                current_time -= comparison_interval
                start, end = self.get_query_window(end=current_time, duration=duration)
                comparison_result = self.query(event, start, end, environment_id=environment_id)
                result = percent_increase(result, comparison_result)

        return result

    def get_rate_bulk(
        self,
        duration: timedelta,
        group_ids: set[int],
        environment_id: int,
        current_time: datetime,
        comparison_interval: timedelta | None,
    ) -> dict[int, int]:
        """
        Make a batch query for multiple groups. The return value is a dictionary
        of group_id to the result for that group.

        If comparison_interval is not None, we're making the second query in a
        percent comparison condition. For example, if the condition is:
            - num of issues is {}% higher in 1 hr compared to 5 min ago
        The second query would be querying for num of events from:
            -  5 min ago to 1 hr 5 min ago
        """
        if comparison_interval:
            current_time -= comparison_interval
        start, end = self.get_query_window(end=current_time, duration=duration)

        with self.disable_consistent_snuba_mode(duration):
            result = self.batch_query(
                group_ids=group_ids,
                start=start,
                end=end,
                environment_id=environment_id,
            )
        return result

    def get_snuba_query_result(
        self,
        tsdb_function: Callable[..., Any],
        keys: list[int],
        group_id: int,
        organization_id: int,
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
            jitter_value=group_id,
            tenant_ids={"organization_id": organization_id},
            referrer_suffix=referrer_suffix,
        )
        return result

    def get_chunked_result(
        self,
        tsdb_function: Callable[..., Any],
        model: TSDBModel,
        group_ids: list[int],
        organization_id: int,
        start: datetime,
        end: datetime,
        environment_id: int,
        referrer_suffix: str,
    ) -> dict[int, int]:
        batch_totals: dict[int, int] = defaultdict(int)
        group_id = group_ids[0]
        for group_chunk in chunked(group_ids, SNUBA_LIMIT):
            result = self.get_snuba_query_result(
                tsdb_function=tsdb_function,
                model=model,
                keys=[group_id for group_id in group_chunk],
                group_id=group_id,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix=referrer_suffix,
            )
            batch_totals.update(result)
        return batch_totals

    def get_error_and_generic_group_ids(
        self,
        groups: QuerySet[Group, _QSTypedDict],
    ) -> tuple[list[int], list[int]]:
        """
        Separate group ids into error group ids and generic group ids
        """
        generic_issue_ids = []
        error_issue_ids = []

        for group in groups:
            issue_type = get_group_type_by_type_id(group["type"])
            if GroupCategory(issue_type.category) == GroupCategory.ERROR:
                error_issue_ids.append(group["id"])
            else:
                generic_issue_ids.append(group["id"])
        return (error_issue_ids, generic_issue_ids)

    def get_value_from_groups(
        self,
        groups: QuerySet[Group, _QSTypedDict] | None,
        value: Literal["id", "project_id", "project__organization_id"],
    ) -> int | None:
        result = None
        if groups:
            group = groups[0]
            result = group.get(value)
        return result

    def get_form_instance(self) -> EventFrequencyForm:
        return EventFrequencyForm(self.data)


class EventFrequencyCondition(BaseEventFrequencyCondition):
    id = "sentry.rules.conditions.event_frequency.EventFrequencyCondition"
    label = "The issue is seen more than {value} times in {interval}"

    def query_hook(
        self, event: GroupEvent, start: datetime, end: datetime, environment_id: int
    ) -> int:
        sums: Mapping[int, int] = self.get_snuba_query_result(
            tsdb_function=self.tsdb.get_sums,
            keys=[event.group_id],
            group_id=event.group.id,
            organization_id=event.group.project.organization_id,
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
        groups = Group.objects.filter(id__in=group_ids).values(
            "id", "type", "project_id", "project__organization_id"
        )
        error_issue_ids, generic_issue_ids = self.get_error_and_generic_group_ids(groups)
        organization_id = self.get_value_from_groups(groups, "project__organization_id")

        if error_issue_ids and organization_id:
            error_sums = self.get_chunked_result(
                tsdb_function=self.tsdb.get_sums,
                model=get_issue_tsdb_group_model(GroupCategory.ERROR),
                group_ids=error_issue_ids,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="batch_alert_event_frequency",
            )
            batch_sums.update(error_sums)

        if generic_issue_ids and organization_id:
            generic_sums = self.get_chunked_result(
                tsdb_function=self.tsdb.get_sums,
                # this isn't necessarily performance, just any non-error category
                model=get_issue_tsdb_group_model(GroupCategory.PERFORMANCE),
                group_ids=generic_issue_ids,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="batch_alert_event_frequency",
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
            group_id=event.group.id,
            organization_id=event.group.project.organization_id,
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
        groups = Group.objects.filter(id__in=group_ids).values(
            "id", "type", "project_id", "project__organization_id"
        )
        error_issue_ids, generic_issue_ids = self.get_error_and_generic_group_ids(groups)
        organization_id = self.get_value_from_groups(groups, "project__organization_id")

        if error_issue_ids and organization_id:
            error_totals = self.get_chunked_result(
                tsdb_function=self.tsdb.get_distinct_counts_totals,
                model=get_issue_tsdb_user_group_model(GroupCategory.ERROR),
                group_ids=error_issue_ids,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="batch_alert_event_uniq_user_frequency",
            )
            batch_totals.update(error_totals)

        if generic_issue_ids and organization_id:
            generic_totals = self.get_chunked_result(
                tsdb_function=self.tsdb.get_distinct_counts_totals,
                # this isn't necessarily performance, just any non-error category
                model=get_issue_tsdb_user_group_model(GroupCategory.PERFORMANCE),
                group_ids=generic_issue_ids,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="batch_alert_event_uniq_user_frequency",
            )
            batch_totals.update(generic_totals)

        return batch_totals

    def get_preview_aggregate(self) -> tuple[str, str]:
        return "uniq", "user"


class EventUniqueUserFrequencyConditionWithConditions(EventUniqueUserFrequencyCondition):
    id = "sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions"
    label = "The issue is seen by more than {value} users in {interval} with conditions"

    def query_hook(
        self, event: GroupEvent, start: datetime, end: datetime, environment_id: int
    ) -> int:
        assert self.rule
        if not features.has(
            "organizations:event-unique-user-frequency-condition-with-conditions",
            Project.objects.get(id=self.rule.project_id).organization,
        ):
            raise NotImplementedError(
                "EventUniqueUserFrequencyConditionWithConditions is not enabled for this organization"
            )
        if self.rule.data["filter_match"] == "any":
            raise NotImplementedError(
                "EventUniqueUserFrequencyConditionWithConditions does not support filter_match == any"
            )

        conditions = []

        for condition in self.rule.data["conditions"]:
            if condition["id"] == self.id:
                continue

            snuba_condition = self.convert_rule_condition_to_snuba_condition(condition)
            if snuba_condition:
                conditions.append(snuba_condition)

        total = self.get_chunked_result(
            tsdb_function=self.tsdb.get_distinct_counts_totals_with_conditions,
            model=get_issue_tsdb_user_group_model(GroupCategory.ERROR),
            organization_id=event.group.project.organization_id,
            group_ids=[event.group.id],
            start=start,
            end=end,
            environment_id=environment_id,
            referrer_suffix="batch_alert_event_uniq_user_frequency",
            conditions=conditions,
        )
        return total[event.group.id]

    def batch_query_hook(
        self, group_ids: set[int], start: datetime, end: datetime, environment_id: int
    ) -> dict[int, int]:
        logger = logging.getLogger(
            "sentry.rules.event_frequency.EventUniqueUserFrequencyConditionWithConditions"
        )
        logger.info(
            "batch_query_hook_start",
            extra={
                "group_ids": group_ids,
                "start": start,
                "end": end,
                "environment_id": environment_id,
            },
        )
        assert self.rule
        if not features.has(
            "organizations:event-unique-user-frequency-condition-with-conditions",
            self.rule.project.organization,
        ):
            raise NotImplementedError(
                "EventUniqueUserFrequencyConditionWithConditions is not enabled for this organization"
            )

        if self.rule.data["filter_match"] == "any":
            raise NotImplementedError(
                "EventUniqueUserFrequencyConditionWithConditions does not support filter_match == any"
            )
        batch_totals: dict[int, int] = defaultdict(int)
        groups = Group.objects.filter(id__in=group_ids).values(
            "id", "type", "project_id", "project__organization_id"
        )
        error_issue_ids, generic_issue_ids = self.get_error_and_generic_group_ids(groups)
        organization_id = self.get_value_from_groups(groups, "project__organization_id")

        conditions = []

        for condition in self.rule.data["conditions"]:
            if condition["id"] == self.id:
                continue

            snuba_condition = self.convert_rule_condition_to_snuba_condition(condition)
            if snuba_condition:
                conditions.append(snuba_condition)

        logger.info(
            "batch_query_hook_conditions",
            extra={"conditions": conditions},
        )
        if error_issue_ids and organization_id:
            error_totals = self.get_chunked_result(
                tsdb_function=self.tsdb.get_distinct_counts_totals_with_conditions,
                model=get_issue_tsdb_user_group_model(GroupCategory.ERROR),
                group_ids=error_issue_ids,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="batch_alert_event_uniq_user_frequency",
                conditions=conditions,
            )
            batch_totals.update(error_totals)

        if generic_issue_ids and organization_id:
            error_totals = self.get_chunked_result(
                tsdb_function=self.tsdb.get_distinct_counts_totals_with_conditions,
                model=get_issue_tsdb_user_group_model(GroupCategory.PERFORMANCE),
                group_ids=generic_issue_ids,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="batch_alert_event_uniq_user_frequency",
                conditions=conditions,
            )
            batch_totals.update(error_totals)

        logger.info(
            "batch_query_hook_end",
            extra={"batch_totals": batch_totals},
        )
        return batch_totals

    def get_snuba_query_result(
        self,
        tsdb_function: Callable[..., Any],
        keys: list[int],
        group_id: int,
        organization_id: int,
        model: TSDBModel,
        start: datetime,
        end: datetime,
        environment_id: int,
        referrer_suffix: str,
        conditions: list[tuple[str, str, str | list[str]]] | None = None,
    ) -> Mapping[int, int]:
        result: Mapping[int, int] = tsdb_function(
            model=model,
            keys=keys,
            start=start,
            end=end,
            environment_id=environment_id,
            use_cache=True,
            jitter_value=group_id,
            tenant_ids={"organization_id": organization_id},
            referrer_suffix=referrer_suffix,
            conditions=conditions,
        )
        return result

    def get_chunked_result(
        self,
        tsdb_function: Callable[..., Any],
        model: TSDBModel,
        group_ids: list[int],
        organization_id: int,
        start: datetime,
        end: datetime,
        environment_id: int,
        referrer_suffix: str,
        conditions: list[tuple[str, str, str | list[str]]] | None = None,
    ) -> dict[int, int]:
        batch_totals: dict[int, int] = defaultdict(int)
        group_id = group_ids[0]
        for group_chunk in chunked(group_ids, SNUBA_LIMIT):
            result = self.get_snuba_query_result(
                tsdb_function=tsdb_function,
                model=model,
                keys=[group_id for group_id in group_chunk],
                group_id=group_id,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix=referrer_suffix,
                conditions=conditions,
            )
            batch_totals.update(result)
        return batch_totals

    @staticmethod
    def convert_rule_condition_to_snuba_condition(
        condition: dict[str, Any]
    ) -> tuple[str, str, str | list[str]] | None:
        if condition["id"] != "sentry.rules.filters.tagged_event.TaggedEventFilter":
            return None
        lhs = f"tags[{condition['key']}]"
        rhs = condition["value"]
        match condition["match"]:
            case MatchType.EQUAL:
                operator = Op.EQ
            case MatchType.NOT_EQUAL:
                operator = Op.NEQ
            case MatchType.STARTS_WITH:
                operator = Op.LIKE
                rhs = f"{rhs}%"
            case MatchType.NOT_STARTS_WITH:
                operator = Op.NOT_LIKE
                rhs = f"{rhs}%"
            case MatchType.ENDS_WITH:
                operator = Op.LIKE
                rhs = f"%{rhs}"
            case MatchType.NOT_ENDS_WITH:
                operator = Op.NOT_LIKE
                rhs = f"%{rhs}"
            case MatchType.CONTAINS:
                operator = Op.LIKE
                rhs = f"%{rhs}%"
            case MatchType.NOT_CONTAINS:
                operator = Op.NOT_LIKE
                rhs = f"%{rhs}%"
            case MatchType.IS_SET:
                operator = Op.IS_NOT_NULL
                rhs = None
            case MatchType.NOT_SET:
                operator = Op.IS_NULL
                rhs = None
            case MatchType.IS_IN:
                operator = Op.IN
                rhs = rhs.split(",")
            case MatchType.NOT_IN:
                operator = Op.NOT_IN
                rhs = rhs.split(",")
            case _:
                raise ValueError(f"Unsupported match type: {condition['match']}")

        return (lhs, operator.value, rhs)


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
                group_id=event.group.id,
                organization_id=event.group.project.organization_id,
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
        groups = Group.objects.filter(id__in=group_ids).values(
            "id", "type", "project_id", "project__organization_id"
        )
        project_id = self.get_value_from_groups(groups, "project_id")

        if not project_id:
            return {group["id"]: 0 for group in groups}

        session_count_last_hour = self.get_session_count(project_id, environment_id, start, end)
        avg_sessions_in_interval = self.get_session_interval(
            session_count_last_hour, self.get_option("interval")
        )

        if not avg_sessions_in_interval:
            return {group["id"]: 0 for group in groups}

        error_issue_ids, generic_issue_ids = self.get_error_and_generic_group_ids(groups)
        organization_id = self.get_value_from_groups(groups, "project__organization_id")

        if not (error_issue_ids and organization_id):
            return {group["id"]: 0 for group in groups}

        error_issue_count = self.get_chunked_result(
            tsdb_function=self.tsdb.get_sums,
            model=get_issue_tsdb_group_model(GroupCategory.ERROR),
            group_ids=error_issue_ids,
            organization_id=organization_id,
            start=start,
            end=end,
            environment_id=environment_id,
            referrer_suffix="batch_alert_event_frequency_percent",
        )

        batch_percents: dict[int, int] = {}
        for group_id, count in error_issue_count.items():
            percent: int = int(100 * round(count / avg_sessions_in_interval, 4))
            batch_percents[group_id] = percent

        # We do not have sessions for non-error issue types
        for group in generic_issue_ids:
            batch_percents[group] = 0

        return batch_percents

    def passes_activity_frequency(
        self, activity: ConditionActivity, buckets: dict[datetime, int]
    ) -> bool:
        raise NotImplementedError

    def get_form_instance(self) -> EventFrequencyPercentForm:
        return EventFrequencyPercentForm(self.data)


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
