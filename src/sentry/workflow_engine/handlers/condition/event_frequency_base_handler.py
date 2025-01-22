import contextlib
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Callable, Mapping
from datetime import datetime, timedelta
from typing import Any, Literal, TypedDict

from django.db.models import QuerySet

from sentry.issues.grouptype import GroupCategory, get_group_type_by_type_id
from sentry.models.group import Group
from sentry.rules.conditions.event_frequency import SNUBA_LIMIT
from sentry.tsdb.base import TSDBModel
from sentry.utils.iterators import chunked
from sentry.utils.snuba import options_override


class _QSTypedDict(TypedDict):
    id: int
    type: int
    project_id: int
    project__organization_id: int


class BaseEventFrequencyConditionHandler(ABC):
    @property
    @abstractmethod
    def intervals(self) -> dict[str, tuple[str, timedelta]]:
        raise NotImplementedError

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
        """For conditions with interval >= 1 hour we don't need to worry about read your writes
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
        self, group_ids: set[int], start: datetime, end: datetime, environment_id: int
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
