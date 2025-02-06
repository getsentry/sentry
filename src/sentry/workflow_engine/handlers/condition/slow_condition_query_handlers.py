import contextlib
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Callable, Mapping
from datetime import datetime, timedelta
from typing import Any, ClassVar, Literal, TypedDict

from django.core.cache import cache
from django.db.models import QuerySet

from sentry import release_health, tsdb
from sentry.issues.constants import get_issue_tsdb_group_model, get_issue_tsdb_user_group_model
from sentry.issues.grouptype import GroupCategory, get_group_type_by_type_id
from sentry.models.group import Group
from sentry.rules.conditions.event_frequency import (
    MIN_SESSIONS_TO_FIRE,
    PERCENT_INTERVALS,
    SNUBA_LIMIT,
    STANDARD_INTERVALS,
)
from sentry.tsdb.base import TSDBModel
from sentry.utils.iterators import chunked
from sentry.utils.registry import Registry
from sentry.utils.snuba import options_override
from sentry.workflow_engine.models.data_condition import Condition


class _QSTypedDict(TypedDict):
    id: int
    type: int
    project_id: int
    project__organization_id: int


class BaseEventFrequencyQueryHandler(ABC):
    intervals: ClassVar[dict[str, tuple[str, timedelta]]] = STANDARD_INTERVALS

    def get_query_window(self, end: datetime, duration: timedelta) -> tuple[datetime, datetime]:
        """
        Calculate the start and end times for the query.
        "duration" is the length of the window we're querying over.
        """
        start = end - duration
        return (start, end)

    def disable_consistent_snuba_mode(
        self, duration: timedelta
    ) -> contextlib.AbstractContextManager[object]:
        """For conditions with interval >= 1 hour we don't need to worry about read or writes
        consistency. Disable it so that we can scale to more nodes.
        """
        option_override_cm: contextlib.AbstractContextManager[object] = contextlib.nullcontext()
        if duration >= timedelta(hours=1):
            option_override_cm = options_override({"consistent": False})
        return option_override_cm

    def get_snuba_query_result(
        self,
        tsdb_function: Callable[..., Any],
        keys: list[int],
        group_id: int,
        organization_id: int,
        model: TSDBModel,
        start: datetime,
        end: datetime,
        environment_id: int | None,
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
        environment_id: int | None,
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

    def get_group_ids_by_category(
        self,
        groups: QuerySet[Group, _QSTypedDict],
    ) -> dict[GroupCategory, list[int]]:
        """
        Separate group ids into error group ids and generic group ids
        """
        category_group_ids: dict[GroupCategory, list[int]] = defaultdict(list)

        for group in groups:
            issue_type = get_group_type_by_type_id(group["type"])
            category = GroupCategory(issue_type.category)
            category_group_ids[category].append(group["id"])

        return category_group_ids

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

    @abstractmethod
    def batch_query(
        self, group_ids: set[int], start: datetime, end: datetime, environment_id: int | None
    ) -> dict[int, int]:
        """
        Abstract method that specifies how to query Snuba for multiple groups
        depending on the condition. Must be implemented by subclasses.
        """
        raise NotImplementedError

    def get_rate_bulk(
        self,
        duration: timedelta,
        group_ids: set[int],
        environment_id: int | None,
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


slow_condition_query_handler_registry = Registry[type[BaseEventFrequencyQueryHandler]](
    enable_reverse_lookup=False
)


@slow_condition_query_handler_registry.register(Condition.EVENT_FREQUENCY_COUNT)
@slow_condition_query_handler_registry.register(Condition.EVENT_FREQUENCY_PERCENT)
class EventFrequencyQueryHandler(BaseEventFrequencyQueryHandler):
    def batch_query(
        self, group_ids: set[int], start: datetime, end: datetime, environment_id: int | None
    ) -> dict[int, int]:
        batch_sums: dict[int, int] = defaultdict(int)
        groups = Group.objects.filter(id__in=group_ids).values(
            "id", "type", "project_id", "project__organization_id"
        )
        category_group_ids = self.get_group_ids_by_category(groups)
        organization_id = self.get_value_from_groups(groups, "project__organization_id")

        if not organization_id:
            return batch_sums

        def get_result(model: TSDBModel, group_ids: list[int]) -> dict[int, int]:
            return self.get_chunked_result(
                tsdb_function=tsdb.backend.get_sums,
                model=model,
                group_ids=group_ids,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="batch_alert_event_frequency",
            )

        for category, issue_ids in category_group_ids.items():
            model = get_issue_tsdb_group_model(category)
            batch_sums.update(get_result(model, issue_ids))

        return batch_sums


@slow_condition_query_handler_registry.register(Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT)
@slow_condition_query_handler_registry.register(Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT)
class EventUniqueUserFrequencyQueryHandler(BaseEventFrequencyQueryHandler):
    def batch_query(
        self, group_ids: set[int], start: datetime, end: datetime, environment_id: int | None
    ) -> dict[int, int]:
        batch_sums: dict[int, int] = defaultdict(int)
        groups = Group.objects.filter(id__in=group_ids).values(
            "id", "type", "project_id", "project__organization_id"
        )
        category_group_ids = self.get_group_ids_by_category(groups)
        organization_id = self.get_value_from_groups(groups, "project__organization_id")

        if not organization_id:
            return batch_sums

        def get_result(model: TSDBModel, group_ids: list[int]) -> dict[int, int]:
            return self.get_chunked_result(
                tsdb_function=tsdb.backend.get_distinct_counts_totals,
                model=model,
                group_ids=group_ids,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="batch_alert_event_uniq_user_frequency",
            )

        for category, issue_ids in category_group_ids.items():
            model = get_issue_tsdb_user_group_model(category)
            batch_sums.update(get_result(model, issue_ids))

        return batch_sums


@slow_condition_query_handler_registry.register(Condition.PERCENT_SESSIONS_COUNT)
@slow_condition_query_handler_registry.register(Condition.PERCENT_SESSIONS_PERCENT)
class PercentSessionsQueryHandler(BaseEventFrequencyQueryHandler):
    intervals: ClassVar[dict[str, tuple[str, timedelta]]] = PERCENT_INTERVALS

    def get_session_count(
        self, project_id: int, environment_id: int | None, start: datetime, end: datetime
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

    def get_session_interval(self, session_count: int, duration: timedelta) -> int | None:
        if session_count >= MIN_SESSIONS_TO_FIRE:
            interval_in_minutes = duration.total_seconds() // 60
            return int(session_count / (60 / interval_in_minutes))
        return None

    def batch_query(
        self, group_ids: set[int], start: datetime, end: datetime, environment_id: int | None
    ) -> dict[int, int]:

        batch_percents: dict[int, int] = defaultdict(int)
        groups = Group.objects.filter(id__in=group_ids).values(
            "id", "type", "project_id", "project__organization_id"
        )
        category_group_ids = self.get_group_ids_by_category(groups)
        project_id = self.get_value_from_groups(groups, "project_id")

        if not project_id:
            return {group["id"]: 0 for group in groups}

        session_count_last_hour = self.get_session_count(project_id, environment_id, start, end)

        duration = end - start  # recalculated duration
        avg_sessions_in_interval = self.get_session_interval(session_count_last_hour, duration)

        if not avg_sessions_in_interval:
            return {group["id"]: 0 for group in groups}

        organization_id = self.get_value_from_groups(groups, "project__organization_id")

        if not organization_id:
            return batch_percents

        def get_result(model: TSDBModel, group_ids: list[int]) -> dict[int, int]:
            return self.get_chunked_result(
                tsdb_function=tsdb.backend.get_sums,
                model=model,
                group_ids=group_ids,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="batch_alert_event_frequency",
            )

        for category, issue_ids in category_group_ids.items():
            # We do not have sessions for non-error issue types
            if category != GroupCategory.ERROR:
                for group_id in issue_ids:
                    batch_percents[group_id] = 0
            else:
                model = get_issue_tsdb_group_model(category)
                results = get_result(model, issue_ids)
                for group_id, count in results.items():
                    percent: int = int(100 * round(count / avg_sessions_in_interval, 4))
                    batch_percents[group_id] = percent

        return batch_percents
