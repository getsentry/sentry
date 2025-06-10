import contextlib
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any, ClassVar, Literal, Protocol, TypedDict

from django.core.cache import cache
from django.db.models import QuerySet
from snuba_sdk import Op

from sentry import release_health, tsdb
from sentry.issues.constants import (
    get_dataset_column_name,
    get_issue_tsdb_group_model,
    get_issue_tsdb_user_group_model,
)
from sentry.issues.grouptype import GroupCategory, get_group_type_by_type_id
from sentry.models.group import Group
from sentry.rules.conditions.event_attribute import ATTR_CHOICES
from sentry.rules.conditions.event_frequency import (
    MIN_SESSIONS_TO_FIRE,
    PERCENT_INTERVALS,
    SNUBA_LIMIT,
    STANDARD_INTERVALS,
)
from sentry.rules.match import MatchType
from sentry.tsdb.base import SnubaCondition, TSDBKey, TSDBModel
from sentry.utils.iterators import chunked
from sentry.utils.registry import Registry
from sentry.utils.snuba import options_override
from sentry.workflow_engine.models.data_condition import Condition

QueryFilter = dict[str, Any]
QueryResult = dict[int, int | float]


class TSDBFunction(Protocol):
    def __call__(
        self,
        model: TSDBModel,
        keys: list[TSDBKey],
        start: datetime,
        end: datetime,
        rollup: int | None = None,
        environment_id: int | None = None,
        use_cache: bool = False,
        jitter_value: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
        referrer_suffix: str | None = None,
        conditions: list[SnubaCondition] | None = None,
        group_on_time: bool = False,
    ) -> Mapping[TSDBKey, int]: ...


class InvalidFilter(Exception):
    """
    Invalid filter snuba query condition for the issue type
    """

    pass


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
        tsdb_function: TSDBFunction,
        keys: list[int],
        group_id: int,
        organization_id: int,
        model: TSDBModel,
        start: datetime,
        end: datetime,
        environment_id: int | None,
        referrer_suffix: str,
        conditions: list[SnubaCondition] | None = None,
        group_on_time: bool = False,
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
            group_on_time=group_on_time,
        )
        return result

    def get_chunked_result(
        self,
        tsdb_function: TSDBFunction,
        model: TSDBModel,
        group_ids: list[int],
        organization_id: int,
        start: datetime,
        end: datetime,
        environment_id: int | None,
        referrer_suffix: str,
        filters: list[QueryFilter] | None = None,
        group_on_time: bool = False,
    ) -> dict[int, int]:
        batch_totals: dict[int, int] = defaultdict(int)
        group_id = group_ids[0]
        conditions = self.get_extra_snuba_conditions(model, filters) if filters else []
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
                group_on_time=group_on_time,
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

    def get_extra_snuba_conditions(
        self, category: TSDBModel, filters: list[QueryFilter]
    ) -> list[SnubaCondition]:
        conditions = []
        for filter in filters:
            snuba_condition = self.convert_filter_to_snuba_condition(filter, category)
            if snuba_condition:
                conditions.append(snuba_condition)
        return conditions

    @staticmethod
    def convert_filter_to_snuba_condition(
        condition: dict[str, Any], tsdb_model: TSDBModel
    ) -> SnubaCondition | None:
        # condition can be TaggedEventFilter (key) or EventAttributeFilter (attribute)
        key = condition.get("key")
        attribute = condition.get("attribute")
        if not key and not attribute:
            return None

        lhs: str | None = None
        if key:
            lhs = f"tags[{condition['key']}]"
        elif attribute:
            column = ATTR_CHOICES.get(attribute)
            if column is None:
                return None

            lhs = get_dataset_column_name(tsdb_model, column.value.alias)

        if lhs is None:
            # Some attribute columns are only available for errors.
            # Raise and catch to return 0 events that meet the filters for other issue types
            raise InvalidFilter

        rhs = (
            condition["value"]
            if condition["match"] not in (MatchType.IS_SET, MatchType.NOT_SET)
            else None
        )
        if attribute == "error.unhandled":
            # flip values, since the queried column is "error.handled"
            rhs = not condition["value"]

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
                if not isinstance(rhs, str):
                    raise ValueError(f"Unsupported value type for {condition['match']}")
                rhs = rhs.split(",")
            case MatchType.NOT_IN:
                operator = Op.NOT_IN
                if not isinstance(rhs, str):
                    raise ValueError(f"Unsupported value type for {condition['match']}")
                rhs = rhs.split(",")
            case _:
                raise ValueError(f"Unsupported match type: {condition['match']}")

        return (lhs, operator.value, rhs)

    @abstractmethod
    def batch_query(
        self,
        group_ids: set[int],
        start: datetime,
        end: datetime,
        environment_id: int | None,
        filters: list[QueryFilter] | None = None,
    ) -> QueryResult:
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
        filters: list[QueryFilter] | None,
    ) -> QueryResult:
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
                filters=filters,
            )
        return result


slow_condition_query_handler_registry = Registry[type[BaseEventFrequencyQueryHandler]](
    enable_reverse_lookup=False
)


@slow_condition_query_handler_registry.register(Condition.EVENT_FREQUENCY_COUNT)
@slow_condition_query_handler_registry.register(Condition.EVENT_FREQUENCY_PERCENT)
class EventFrequencyQueryHandler(BaseEventFrequencyQueryHandler):
    def batch_query(
        self,
        group_ids: set[int],
        start: datetime,
        end: datetime,
        environment_id: int | None,
        filters: list[QueryFilter] | None = None,
    ) -> QueryResult:
        batch_sums: QueryResult = defaultdict(int)
        groups = Group.objects.filter(id__in=group_ids).values(
            "id", "type", "project_id", "project__organization_id"
        )
        category_group_ids = self.get_group_ids_by_category(groups)
        organization_id = self.get_value_from_groups(groups, "project__organization_id")

        if not organization_id:
            return batch_sums

        for category, issue_ids in category_group_ids.items():
            model = get_issue_tsdb_group_model(category)
            try:
                results = self.get_chunked_result(
                    tsdb_function=tsdb.backend.get_sums,
                    model=model,
                    group_ids=issue_ids,
                    organization_id=organization_id,
                    start=start,
                    end=end,
                    environment_id=environment_id,
                    referrer_suffix="wf_batch_alert_event_frequency",
                    filters=filters,
                    group_on_time=False,
                )
            except InvalidFilter:
                # Filter is not supported for this issue type
                # no events meet the query criteria
                results = {issue_id: 0 for issue_id in issue_ids}

            batch_sums.update(results)

        return batch_sums


@slow_condition_query_handler_registry.register(Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT)
@slow_condition_query_handler_registry.register(Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT)
class EventUniqueUserFrequencyQueryHandler(BaseEventFrequencyQueryHandler):
    def batch_query(
        self,
        group_ids: set[int],
        start: datetime,
        end: datetime,
        environment_id: int | None,
        filters: list[QueryFilter] | None = None,
    ) -> QueryResult:
        batch_sums: QueryResult = defaultdict(int)
        groups = Group.objects.filter(id__in=group_ids).values(
            "id", "type", "project_id", "project__organization_id"
        )
        category_group_ids = self.get_group_ids_by_category(groups)
        organization_id = self.get_value_from_groups(groups, "project__organization_id")

        if not organization_id:
            return batch_sums

        for category, issue_ids in category_group_ids.items():
            model = get_issue_tsdb_user_group_model(category)
            try:
                results = self.get_chunked_result(
                    tsdb_function=tsdb.backend.get_distinct_counts_totals,
                    model=model,
                    group_ids=issue_ids,
                    organization_id=organization_id,
                    start=start,
                    end=end,
                    environment_id=environment_id,
                    referrer_suffix="wf_batch_alert_event_uniq_user_frequency",
                    filters=filters,
                    group_on_time=False,
                )
            except InvalidFilter:
                # Filter is not supported for this issue type
                # no events meet the query criteria
                results = {issue_id: 0 for issue_id in issue_ids}
            batch_sums.update(results)

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
        self,
        group_ids: set[int],
        start: datetime,
        end: datetime,
        environment_id: int | None,
        filters: list[QueryFilter] | None = None,
    ) -> QueryResult:
        batch_percents: QueryResult = {}
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

        for category, issue_ids in category_group_ids.items():
            # We do not have sessions for non-error issue types
            if category != GroupCategory.ERROR:
                for group_id in issue_ids:
                    batch_percents[group_id] = 0
                continue

            model = get_issue_tsdb_group_model(category)
            # InvalidFilter should not be raised for errors
            results = self.get_chunked_result(
                tsdb_function=tsdb.backend.get_sums,
                model=model,
                group_ids=issue_ids,
                organization_id=organization_id,
                start=start,
                end=end,
                environment_id=environment_id,
                referrer_suffix="wf_batch_alert_event_frequency_percent",
                filters=filters,
                group_on_time=False,
            )
            for group_id, count in results.items():
                percent: float = 100 * round(count / avg_sessions_in_interval, 4)
                batch_percents[group_id] = percent

        return batch_percents
