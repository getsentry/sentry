from __future__ import annotations

import dataclasses
import functools
import logging
import time
from abc import ABCMeta, abstractmethod
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum, auto
from hashlib import md5
from math import floor
from typing import Any, TypedDict, cast

import sentry_sdk
from django.db.models import Q
from django.utils import timezone
from snuba_sdk import (
    BooleanCondition,
    BooleanOp,
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Identifier,
    Join,
    Lambda,
    Limit,
    Op,
    OrderBy,
    Request,
)
from snuba_sdk.conditions import Or
from snuba_sdk.expressions import Expression
from snuba_sdk.query import Query
from snuba_sdk.relationships import Relationship

from sentry import features, options
from sentry.api.event_search import SearchFilter
from sentry.api.paginator import MAX_SNUBA_ELEMENTS, DateTimePaginator, Paginator, SequencePaginator
from sentry.api.serializers.models.group import SKIP_SNUBA_FIELDS
from sentry.constants import ALLOWED_FUTURE_DELTA
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues import grouptype
from sentry.issues.grouptype import GroupCategory, get_group_types_by_category
from sentry.issues.search import (
    SEARCH_FILTER_UPDATERS,
    IntermediateSearchQueryPartial,
    MergeableRow,
    SearchQueryPartial,
    UnsupportedSearchQuery,
    get_search_strategies,
    group_categories_from,
    group_types_from,
)
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.team import Team
from sentry.search.events.builder.discover import UnresolvedQuery
from sentry.search.events.filter import convert_search_filter_to_snuba_query, format_search_filter
from sentry.search.events.types import SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.utils import json, metrics, snuba
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.snuba import SnubaQueryParams, aliased_query_params, bulk_raw_query

FIRST_RELEASE_FILTERS = ["first_release", "firstRelease"]


class TrendsSortWeights(TypedDict):
    log_level: int
    has_stacktrace: int
    relative_volume: int
    event_halflife_hours: int
    issue_halflife_hours: int
    v2: bool
    norm: bool


DEFAULT_TRENDS_WEIGHTS: TrendsSortWeights = {
    "log_level": 0,
    "has_stacktrace": 0,
    "relative_volume": 1,
    "event_halflife_hours": 4,
    "issue_halflife_hours": 12,
    "v2": True,
    "norm": False,
}


class Clauses(Enum):
    HAVING = auto()
    WHERE = auto()


# we cannot use snuba for these fields because they require a join with tables that don't exist there
# if we ever see these fields, we will use postgres to get the group_ids before sending back to ClickHouse
# note that we could eventually migrate the releases table to ClickHouse and handle those with a join in ClickHouse
POSTGRES_ONLY_SEARCH_FIELDS = [
    "bookmarked_by",
    "linked",
    "subscribed_by",
    "regressed_in_release",
    "for_review",
]


ENTITY_EVENTS = "events"
ENTITY_GROUP_ATTRIBUTES = "group_attributes"
ENTITY_SEARCH_ISSUES = "search_issues"


@dataclass
class TrendsParams:
    # (event or issue age_hours) / (event or issue halflife hours)
    # any event or issue age that is greater than max_pow times the half-life hours will get clipped
    max_pow: int
    min_score: float  # apply a min on the individual scores to avoid multiplying by zeroes

    # event-aggregate scoring
    event_age_weight: int  # [1, 5]
    log_level_weight: int  # [0, 10]
    stacktrace_weight: int  # [0, 3]
    event_halflife_hours: int  # halves score every x hours

    # issue-aggregate scoring
    issue_age_weight: int  # [1, 5]
    issue_halflife_hours: int  # halves score every x hours
    relative_volume_weight: int  # [0, 10]

    v2: bool
    normalize: bool


def get_search_filter(
    search_filters: Sequence[SearchFilter] | None, name: str, operator: str
) -> Any | None:
    """
    Finds the value of a search filter with the passed name and operator. If
    multiple values are found, returns the most restrictive value
    :param search_filters: collection of `SearchFilter` objects
    :param name: Name of the field to find
    :param operator: '<', '>' or '='
    :return: The value of the field if found, else None
    """
    if not search_filters:
        return None
    assert operator in ("<", ">", "=", "IN")
    comparator = max if operator.startswith(">") else min
    found_val = None
    for search_filter in search_filters:
        # Note that we check operator with `startswith` here so that we handle
        # <, <=, >, >=
        if search_filter.key.name == name and search_filter.operator.startswith(operator):
            val = search_filter.value.raw_value
            found_val = comparator(val, found_val) if found_val else val  # type: ignore[type-var]  # SearchFilter is an unsound union
    return found_val


def group_categories_from_search_filters(
    search_filters: Sequence[SearchFilter], organization: Organization, actor: User | RpcUser
) -> set[int]:
    group_categories = group_categories_from(search_filters)

    if not group_categories:
        group_categories = set(get_search_strategies().keys())
        # if we're not searching for feedbacks, then hide them by default
        group_categories.discard(GroupCategory.FEEDBACK.value)

    if not features.has("organizations:performance-issues-search", organization):
        group_categories.discard(GroupCategory.PERFORMANCE.value)

    return group_categories


class AbstractQueryExecutor(metaclass=ABCMeta):
    """This class serves as a template for Query Executors.
    We subclass it in order to implement query methods (we use it to implement two classes: joined
    Postgres+Snuba queries, and Snuba only queries)
    It's used to keep the query logic out of the actual search backend,
    which can now just build query parameters and use the appropriate query executor to run the query
    """

    @property
    @abstractmethod
    def aggregation_defs(self) -> Sequence[str] | Expression:
        """This method should return a dict of key:value
        where key is a field name for your aggregation
        and value is the aggregation function"""
        raise NotImplementedError

    @property
    @abstractmethod
    def dependency_aggregations(self) -> Mapping[str, list[str]]:
        """This method should return a dict of key:value
        where key is an aggregation_def field name
        and value is a list of aggregation field names that the 'key' aggregation requires."""
        raise NotImplementedError

    @property
    def empty_result(self) -> CursorResult[Group]:
        # TODO: Add types to paginators and remove this
        return cast(CursorResult[Group], Paginator(Group.objects.none()).get_result())

    @property
    @abstractmethod
    def dataset(self) -> Dataset:
        """This function should return an enum from snuba.Dataset (like snuba.Dataset.Events)"""
        raise NotImplementedError

    @property
    @abstractmethod
    def sort_strategies(self) -> Mapping[str, str]:
        raise NotImplementedError

    @property
    @abstractmethod
    def postgres_only_fields(self) -> set[str]:
        raise NotImplementedError

    @abstractmethod
    def query(
        self,
        projects: Sequence[Project],
        retention_window_start: datetime | None,
        group_queryset: BaseQuerySet,
        environments: Sequence[Environment] | None,
        sort_by: str,
        limit: int,
        cursor: Cursor | None,
        count_hits: bool,
        paginator_options: Mapping[str, Any] | None,
        search_filters: Sequence[SearchFilter] | None,
        date_from: datetime | None,
        date_to: datetime | None,
        max_hits: int | None = None,
        referrer: str | None = None,
        actor: Any | None = None,
        aggregate_kwargs: TrendsSortWeights | None = None,
        use_group_snuba_dataset: bool = False,
    ) -> CursorResult[Group]:
        """This function runs your actual query and returns the results
        We usually return a paginator object, which contains the results and the number of hits"""
        raise NotImplementedError

    def _convert_search_filters(
        self,
        organization_id: int,
        project_ids: Sequence[int],
        environments: Sequence[str] | None,
        search_filters: Sequence[SearchFilter],
    ) -> list[Any | None]:
        """Converts the SearchFilter format into snuba-compatible clauses"""
        converted_filters: list[Sequence[Any] | None] = []
        for search_filter in search_filters or ():
            conditions, projects_to_filter, group_ids = format_search_filter(
                search_filter,
                params={
                    "organization_id": organization_id,
                    "project_id": project_ids,
                    "environment": environments,
                },
            )

            # if no re-formatted conditions, use fallback method for selected groups
            new_condition = None
            if conditions:
                new_condition = conditions[0]
            elif group_ids:
                new_condition = convert_search_filter_to_snuba_query(
                    search_filter,
                    params={
                        "organization_id": organization_id,
                        "project_id": project_ids,
                        "environment": environments,
                    },
                )

            if new_condition:
                converted_filters.append(new_condition)

        return converted_filters

    def _prepare_aggregations(
        self,
        sort_field: str,
        start: datetime,
        end: datetime,
        having: Sequence[Sequence[Any]],
        aggregate_kwargs: TrendsSortWeights | None = None,
        replace_trends_aggregation: bool | None = False,
    ) -> list[Any]:
        extra_aggregations = self.dependency_aggregations.get(sort_field, [])
        required_aggregations = set([sort_field, "total"] + extra_aggregations)
        for h in having:
            alias = h[0]
            required_aggregations.add(alias)

        aggregations = []
        for alias in required_aggregations:
            aggregation = self.aggregation_defs[alias]
            if replace_trends_aggregation and alias == "trends":
                aggregation = self.aggregation_defs["trends_issue_platform"]
            if callable(aggregation):
                if aggregate_kwargs:
                    aggregation = aggregation(start, end, aggregate_kwargs.get(alias, {}))
                else:
                    aggregation = aggregation(start, end, DEFAULT_TRENDS_WEIGHTS)
            aggregations.append(aggregation + [alias])

        return aggregations

    def _prepare_params_for_category(
        self,
        group_category: int,
        query_partial: IntermediateSearchQueryPartial,
        organization: Organization,
        project_ids: Sequence[int],
        environments: Sequence[str] | None,
        group_ids: Sequence[int] | None,
        filters: Mapping[str, Sequence[int]],
        search_filters: Sequence[SearchFilter],
        sort_field: str,
        start: datetime,
        end: datetime,
        cursor: Cursor | None,
        get_sample: bool,
        actor: Any | None = None,
        aggregate_kwargs: TrendsSortWeights | None = None,
    ) -> SnubaQueryParams | None:
        """
        :raises UnsupportedSearchQuery: when search_filters includes conditions on a dataset that doesn't support it
        """

        if group_category in SEARCH_FILTER_UPDATERS:
            # remove filters not relevant to the group_category
            search_filters = SEARCH_FILTER_UPDATERS[group_category](search_filters)

        # convert search_filters to snuba format
        converted_filters = self._convert_search_filters(
            organization.id, project_ids, environments, search_filters
        )

        # categorize the clauses into having or condition clauses
        having = []
        conditions = []
        for search_filter, converted_filter in zip(search_filters, converted_filters):
            if converted_filter is not None:
                # Ensure that no user-generated tags that clashes with aggregation_defs is added to having
                if search_filter.key.name in self.aggregation_defs and not search_filter.key.is_tag:
                    having.append(converted_filter)
                else:
                    conditions.append(converted_filter)

        if sort_field == "trends" and group_category is not GroupCategory.ERROR.value:
            aggregations = self._prepare_aggregations(
                sort_field, start, end, having, aggregate_kwargs, True
            )
        else:
            aggregations = self._prepare_aggregations(
                sort_field, start, end, having, aggregate_kwargs
            )

        if cursor is not None:
            having.append((sort_field, ">=" if cursor.is_prev else "<=", cursor.value))

        selected_columns = []
        if get_sample:
            query_hash = md5(json.dumps(conditions).encode("utf-8")).hexdigest()[:8]
            selected_columns.append(["cityHash64", [f"'{query_hash}'", "group_id"], "sample"])
            orderby = ["sample"]
        else:
            # Get the top matching groups by score, i.e. the actual search results
            # in the order that we want them.
            orderby = [f"-{sort_field}", "group_id"]  # ensure stable sort within the same score

        pinned_query_partial: SearchQueryPartial = cast(
            SearchQueryPartial,
            functools.partial(
                query_partial,
                groupby=["group_id"],
                having=having,
                orderby=orderby,
            ),
        )

        strategy = get_search_strategies()[group_category]
        snuba_query_params = strategy(
            pinned_query_partial,
            selected_columns,
            aggregations,
            organization.id,
            project_ids,
            environments,
            group_ids,
            filters,
            conditions,
            actor,
        )
        if snuba_query_params is not None:
            snuba_query_params.kwargs["tenant_ids"] = {"organization_id": organization.id}
        return snuba_query_params

    def snuba_search(
        self,
        start: datetime,
        end: datetime,
        project_ids: Sequence[int],
        environment_ids: Sequence[int] | None,
        sort_field: str,
        organization: Organization,
        cursor: Cursor | None = None,
        group_ids: Sequence[int] | None = None,
        limit: int | None = None,
        offset: int = 0,
        get_sample: bool = False,
        search_filters: Sequence[SearchFilter] | None = None,
        referrer: str | None = None,
        actor: Any | None = None,
        aggregate_kwargs: TrendsSortWeights | None = None,
    ) -> tuple[list[tuple[int, Any]], int]:
        """Queries Snuba for events with associated Groups based on the input criteria.

        Returns a tuple of:
            * a sorted list of (group_id, group_score) tuples sorted descending by score,
            * the count of total results (rows) available for this query.
        """
        filters = {"project_id": project_ids}

        environments = None
        if environment_ids is not None:
            filters["environment"] = environment_ids
            environments = list(
                Environment.objects.filter(
                    organization_id=organization.id, id__in=environment_ids
                ).values_list("name", flat=True)
            )

        referrer = referrer or "search"
        referrer = f"{referrer}_sample" if get_sample else referrer

        snuba_search_filters = [
            sf
            for sf in search_filters or ()
            # remove any search_filters that are only available in postgres, we special case date
            if not (sf.key.name in self.postgres_only_fields.union(["date", "timestamp"]))
        ]

        # common pinned parameters that won't change based off datasource
        query_partial: IntermediateSearchQueryPartial = cast(
            IntermediateSearchQueryPartial,
            functools.partial(
                aliased_query_params,
                start=start,
                end=end,
                limit=limit,
                offset=offset,
                referrer=referrer,
                totals=True,  # Needs to have totals_mode=after_having_exclusive so we get groups matching HAVING only
                turbo=get_sample,  # Turn off FINAL when in sampling mode
                sample=1,  # Don't use clickhouse sampling, even when in turbo mode.
            ),
        )

        group_categories = group_categories_from_search_filters(search_filters, organization, actor)

        query_params_for_categories = {}

        for gc in group_categories:
            try:
                query_params = self._prepare_params_for_category(
                    gc,
                    query_partial,
                    organization,
                    project_ids,
                    environments,
                    group_ids,
                    filters,
                    snuba_search_filters,
                    sort_field,
                    start,
                    end,
                    cursor,
                    get_sample,
                    actor,
                    aggregate_kwargs,
                )
            except UnsupportedSearchQuery:
                pass
            else:
                if query_params is not None:
                    query_params_for_categories[gc] = query_params

        try:
            bulk_query_results = bulk_raw_query(
                list(query_params_for_categories.values()), referrer=referrer
            )
        except Exception:
            metrics.incr(
                "snuba.search.group_category_bulk",
                tags={
                    GroupCategory(gc_val).name.lower(): True
                    for gc_val, _ in query_params_for_categories.items()
                },
            )
            # one of the parallel bulk raw queries failed (maybe the issue platform dataset),
            # we'll fallback to querying for errors only
            if GroupCategory.ERROR.value in query_params_for_categories.keys():
                bulk_query_results = bulk_raw_query(
                    [query_params_for_categories[GroupCategory.ERROR.value]], referrer=referrer
                )
            else:
                raise

        rows: list[MergeableRow] = []
        total = 0
        row_length = 0
        for bulk_result in bulk_query_results:
            if bulk_result:
                if bulk_result["data"]:
                    rows.extend(bulk_result["data"])
                if bulk_result["totals"]["total"]:
                    total += bulk_result["totals"]["total"]
                row_length += len(bulk_result)

        rows.sort(key=lambda row: row["group_id"])

        if not get_sample:
            metrics.distribution("snuba.search.num_result_groups", row_length)

        if get_sample:
            sort_field = "sample"

        return [(row["group_id"], row[sort_field]) for row in rows], total  # type: ignore[literal-required]

    def has_sort_strategy(self, sort_by: str) -> bool:
        return sort_by in self.sort_strategies.keys()


def trends_aggregation(
    start: datetime,
    end: datetime,
    aggregate_kwargs: TrendsSortWeights,
) -> Sequence[str]:
    return trends_aggregation_impl(
        TrendsParams(
            max_pow=16,
            min_score=0.01,
            event_age_weight=1,
            log_level_weight=aggregate_kwargs["log_level"],
            stacktrace_weight=aggregate_kwargs["has_stacktrace"],
            event_halflife_hours=aggregate_kwargs["event_halflife_hours"],
            issue_age_weight=1,
            issue_halflife_hours=aggregate_kwargs["issue_halflife_hours"],
            relative_volume_weight=aggregate_kwargs["relative_volume"],
            v2=aggregate_kwargs["v2"],
            normalize=aggregate_kwargs["norm"],
        ),
        "timestamp",
        True,
        start,
        end,
    )


def trends_issue_platform_aggregation(
    start: datetime,
    end: datetime,
    aggregate_kwargs: TrendsSortWeights,
) -> Sequence[str]:
    return trends_aggregation_impl(
        TrendsParams(
            max_pow=16,
            min_score=0.01,
            event_age_weight=1,
            log_level_weight=aggregate_kwargs["log_level"],
            stacktrace_weight=0,  # issue-platform occurrences won't have stacktrace
            event_halflife_hours=aggregate_kwargs["event_halflife_hours"],
            issue_age_weight=1,
            issue_halflife_hours=aggregate_kwargs["issue_halflife_hours"],
            relative_volume_weight=aggregate_kwargs["relative_volume"],
            v2=aggregate_kwargs["v2"],
            normalize=aggregate_kwargs["norm"],
        ),
        "client_timestamp",
        False,
        start,
        end,
    )


def trends_aggregation_impl(
    params: TrendsParams,
    timestamp_column: str,
    use_stacktrace: bool,
    start: datetime,
    end: datetime,
) -> Sequence[str]:
    min_score = params.min_score
    max_pow = params.max_pow
    event_age_weight = params.event_age_weight
    event_halflife_hours = params.event_halflife_hours
    log_level_weight = params.log_level_weight
    stacktrace_weight = params.stacktrace_weight
    relative_volume_weight = params.relative_volume_weight
    issue_age_weight = params.issue_age_weight
    issue_halflife_hours = params.issue_halflife_hours

    event_age_hours = f"divide(now() - {timestamp_column}, 3600)"
    issue_age_hours = f"divide(now() - min({timestamp_column}), 3600)"
    log_level_score = "multiIf(equals(level, 'fatal'), 1.0, equals(level, 'error'), 0.66, equals(level, 'warning'), 0.33, 0.0)"
    stacktrace_score = "if(notEmpty(exception_stacks.type), 1.0, 0.0)"
    # event_agg_rank:
    #   ls = log_level_score    {1.0, 0.66, 0.33, 0}
    #   lw = log_level_weight   [0, 10]
    #   ss = stacktrace_score   {1.0, 0.0}
    #   sw = stacktrace_weight  [0, 3]
    #   as = event_age_score    [1, 0]
    #   aw = event_age_weight   [1, 5]
    #
    #        (ls * lw) + (ss * sw) + (as * aw)     min(f(x)  = 0, when individual scores are all 0
    # f(x) = ---------------------------------  ,  max(f(x)) = 1, when individual scores are all 1
    #                  lw + sw + aw
    #
    if use_stacktrace:
        event_agg_numerator = f"plus(plus(multiply({log_level_score}, {log_level_weight}), multiply({stacktrace_score}, {stacktrace_weight})), {event_age_weight})"
    else:
        event_agg_numerator = (
            f"plus(multiply({log_level_score}, {log_level_weight}), {event_age_weight})"
        )

    event_agg_denominator = (
        f"plus(plus({log_level_weight}, {stacktrace_weight}), {event_age_weight})"
    )
    event_agg_rank = f"divide({event_agg_numerator}, {event_agg_denominator})"  # values from [0, 1]

    aggregate_issue_score = f"greatest({min_score}, divide({issue_age_weight}, pow(2, least({max_pow}, divide({issue_age_hours}, {issue_halflife_hours})))))"

    if not params.v2:
        aggregate_event_score = f"greatest({min_score}, sum(divide({event_agg_rank}, pow(2, least({max_pow}, divide({event_age_hours}, {event_halflife_hours}))))))"
        return [f"multiply({aggregate_event_score}, {aggregate_issue_score})", ""]
    else:
        #  * apply log to event score summation to clamp the contribution of event scores to a reasonable maximum
        #  * add an extra 'relative volume score' (# of events in past 60 mins / # of events in the past 7 days)
        #    to factor in the volume of events that recently were fired versus the past. This will up-rank issues
        #    that are more recently active as a function of the overall amount of events grouped to that issue
        #  * add a configurable weight to 'relative volume score'
        #  * conditionally normalize all the scores so the range of values sweeps from 0.0 to 1.0

        # aggregate_event_score:
        #
        # ------------------------------------------------------------------------------
        # part 1 (summation over all events in group)
        #   x = event_age_hours
        #   k = event_halflife_hours (fixed to a constant)
        #      1
        # Σ ------- = Σ ([1, 0), [1, 0), [1, 0), ...) ~= [0, +inf] = g(x)
        #   2^(x/k)
        #
        # ------------------------------------------------------------------------------
        # part 2a (offset by 1 to remove possibility of ln(0))
        # g(x) + 1 = [1, +inf] = h(x)
        #
        # ------------------------------------------------------------------------------
        # part 2b (apply ln to clamp exponential growth and apply a 'fixed' maximum)
        #                            x = 1, e,    10,  1000, 1000000, 1000000000, ...
        # ln(h(x)) = [ln(1), ln(+inf)] = 0, 1, ~2.30, ~6.09,  ~13.81,     ~20.72, +inf
        aggregate_event_score = f"log(plus(1, sum(divide({event_agg_rank}, pow(2, divide({event_age_hours}, {event_halflife_hours}))))))"

        date_period = end - start

        if date_period.days >= 7:
            overall_event_count_seconds = 3600 * 24 * 7
            recent_event_count_seconds = 3600
        else:
            overall_event_count_seconds = int(date_period.total_seconds())
            recent_event_count_seconds = floor(overall_event_count_seconds * 0.01)

        recent_event_count = (
            f"countIf(lessOrEquals(minus(now(), {timestamp_column}), {recent_event_count_seconds}))"
        )
        overall_event_count = f"countIf(lessOrEquals(minus(now(), {timestamp_column}), {overall_event_count_seconds}))"

        max_relative_volume_weight = 10
        if relative_volume_weight > max_relative_volume_weight:
            relative_volume_weight = max_relative_volume_weight
        relative_volume_score = f"divide({recent_event_count}, plus({overall_event_count}, 1))"
        scaled_relative_volume_score = f"divide(multiply({relative_volume_weight}, {relative_volume_score}), {max_relative_volume_weight})"

        if not params.normalize:
            return [
                f"multiply(multiply({aggregate_issue_score}, greatest({min_score}, {aggregate_event_score})), greatest({min_score}, {scaled_relative_volume_score}))",
                "",
            ]
        else:
            # aggregate_issue_score:
            #   x = issue_age_hours
            #   k = issue_halflife_hours (fixed to a constant)
            #                          k = 4
            # lim           1          x = 0,     1,     10,  100000000
            # x -> inf   -------    f(x) = 1, ~0.84,  ~0.16,  ~0
            #            2^(x/k)
            normalized_aggregate_issue_score = aggregate_issue_score  # already ranges from 1 to 0
            normalized_relative_volume_score = (
                scaled_relative_volume_score  # already normalized since it's a percentage
            )

            # aggregate_event_score ranges from [0, +inf], as the amount of events grouped to this issue
            # increases. we apply an upper bound of 21 to the log of the summation of the event scores
            # and then divide by 21 so the normalized score sweeps from [0, 1]
            # In practice, itll take a degenerate issue with an absurd amount of events for the
            # aggregate_event_score to reach to upper limit of ~21 (and normalized score of 1)
            normalized_aggregate_event_score = f"divide(least({aggregate_event_score}, 21), 21)"

            return [
                f"plus(plus({normalized_aggregate_issue_score}, {normalized_aggregate_event_score}), {normalized_relative_volume_score})",
                "",
            ]


class PostgresSnubaQueryExecutor(AbstractQueryExecutor):
    ISSUE_FIELD_NAME = "group_id"

    logger = logging.getLogger("sentry.search.postgressnuba")
    dependency_aggregations = {"trends": ["last_seen", "times_seen"]}
    postgres_only_fields = {*SKIP_SNUBA_FIELDS, "regressed_in_release"}
    # add specific fields here on top of skip_snuba_fields from the serializer
    sort_strategies = {
        "date": "last_seen",
        "freq": "times_seen",
        "new": "first_seen",
        "trends": "trends",
        "user": "user_count",
        # We don't need a corresponding snuba field here, since this sort only happens
        # in Postgres
        "inbox": "",
    }

    aggregation_defs = {
        "times_seen": ["count()", ""],
        "first_seen": ["multiply(toUInt64(min(timestamp)), 1000)", ""],
        "last_seen": ["multiply(toUInt64(max(timestamp)), 1000)", ""],
        "trends": trends_aggregation,
        # Only makes sense with WITH TOTALS, returns 1 for an individual group.
        "total": ["uniq", ISSUE_FIELD_NAME],
        "user_count": ["uniq", "tags[sentry:user]"],
        "trends_issue_platform": trends_issue_platform_aggregation,
    }

    @property
    def dataset(self) -> Dataset:
        return Dataset.Events

    def query(
        self,
        projects: Sequence[Project],
        retention_window_start: datetime | None,
        group_queryset: BaseQuerySet,
        environments: Sequence[Environment] | None,
        sort_by: str,
        limit: int,
        cursor: Cursor | None,
        count_hits: bool,
        paginator_options: Mapping[str, Any] | None,
        search_filters: Sequence[SearchFilter] | None,
        date_from: datetime | None,
        date_to: datetime | None,
        max_hits: int | None = None,
        referrer: str | None = None,
        actor: Any | None = None,
        aggregate_kwargs: TrendsSortWeights | None = None,
    ) -> CursorResult[Group]:
        now = timezone.now()
        end = None
        paginator_options = {} if paginator_options is None else paginator_options
        end_params = [
            _f
            for _f in [
                date_to,
                get_search_filter(search_filters, "date", "<"),
                get_search_filter(search_filters, "timestamp", "<"),
            ]
            if _f
        ]
        if end_params:
            end = min(end_params)

        if not end:
            end = now + ALLOWED_FUTURE_DELTA
            allow_postgres_only_search = True
        else:
            allow_postgres_only_search = features.has(
                "organizations:issue-search-allow-postgres-only-search", projects[0].organization
            )

        # TODO: Presumably we only want to search back to the project's max
        # retention date, which may be closer than 90 days in the past, but
        # apparently `retention_window_start` can be None(?), so we need a
        # fallback.
        retention_date = max(_f for _f in [retention_window_start, now - timedelta(days=90)] if _f)
        start_params = [
            date_from,
            retention_date,
            get_search_filter(search_filters, "date", ">"),
            get_search_filter(search_filters, "timestamp", ">"),
        ]
        start = max(_f for _f in start_params if _f)
        end = max([retention_date, end])

        if start == retention_date and end == retention_date:
            # Both `start` and `end` must have been trimmed to `retention_date`,
            # so this entire search was against a time range that is outside of
            # retention. We'll return empty results to maintain backwards compatibility
            # with Django search (for now).
            return self.empty_result

        if start >= end:
            # TODO: This maintains backwards compatibility with Django search, but
            # in the future we should find a way to notify the user that their search
            # is invalid.
            return self.empty_result

        # If the requested sort is `date` (`last_seen`) and there
        # are no other Snuba-based search predicates, we can simply
        # return the results from Postgres.
        if (
            # XXX: Don't enable this for now, it doesn't properly respect issue platform rules for hiding issue types.
            # We'll need to consolidate where we apply the type filters if we do want this.
            allow_postgres_only_search
            and cursor is None
            and sort_by == "date"
            and
            # This handles tags and date parameters for search filters.
            not [
                sf
                for sf in (search_filters or ())
                if sf.key.name not in self.postgres_only_fields.union(["date", "timestamp"])
            ]
        ):
            group_queryset = (
                group_queryset.using_replica()
                .filter(last_seen__gte=start, last_seen__lte=end)
                .order_by("-last_seen")
            )

            for sf in search_filters or ():
                # general search query:
                if "message" == sf.key.name and isinstance(sf.value.raw_value, str):
                    group_queryset = group_queryset.filter(
                        Q(type=ErrorGroupType.type_id)
                        | (
                            Q(type__in=get_group_types_by_category(GroupCategory.PERFORMANCE.value))
                            and (
                                ~Q(message__icontains=sf.value.raw_value)
                                if sf.is_negation
                                else Q(message__icontains=sf.value.raw_value)
                            )
                        )
                    )

            paginator = DateTimePaginator(group_queryset, "-last_seen", **paginator_options)

            # When it's a simple django-only search, we count_hits like normal
            results = paginator.get_result(limit, cursor, count_hits=count_hits, max_hits=max_hits)
            metrics.timing(
                "snuba.search.query",
                (timezone.now() - now).total_seconds(),
                tags={"postgres_only": True},
            )
            return results

        # Here we check if all the django filters reduce the set of groups down
        # to something that we can send down to Snuba in a `group_id IN (...)`
        # clause.
        max_candidates = options.get("snuba.search.max-pre-snuba-candidates")

        with sentry_sdk.start_span(op="snuba_group_query") as span:
            group_ids = list(
                group_queryset.using_replica().values_list("id", flat=True)[: max_candidates + 1]
            )
            span.set_data("Max Candidates", max_candidates)
            span.set_data("Result Size", len(group_ids))
        metrics.distribution("snuba.search.num_candidates", len(group_ids))
        too_many_candidates = False
        if not group_ids:
            # no matches could possibly be found from this point on
            metrics.incr("snuba.search.no_candidates", skip_internal=False)
            return self.empty_result
        elif len(group_ids) > max_candidates:
            # If the pre-filter query didn't include anything to significantly
            # filter down the number of results (from 'first_release', 'status',
            # 'bookmarked_by', 'assigned_to', 'unassigned', or 'subscribed_by')
            # then it might have surpassed the `max_candidates`. In this case,
            # we *don't* want to pass candidates down to Snuba, and instead we
            # want Snuba to do all the filtering/sorting it can and *then* apply
            # this queryset to the results from Snuba, which we call
            # post-filtering.
            metrics.incr("snuba.search.too_many_candidates", skip_internal=False)
            too_many_candidates = True
            group_ids = []

        sort_field = self.sort_strategies[sort_by]
        chunk_growth = options.get("snuba.search.chunk-growth-rate")
        max_chunk_size = options.get("snuba.search.max-chunk-size")
        chunk_limit = limit
        offset = 0
        num_chunks = 0
        hits = self.calculate_hits(
            group_ids,
            too_many_candidates,
            sort_field,
            projects,
            retention_window_start,
            group_queryset,
            environments,
            sort_by,
            limit,
            cursor,
            count_hits,
            paginator_options,
            search_filters,
            start,
            end,
            actor,
        )
        if count_hits and hits == 0:
            return self.empty_result

        paginator_results = self.empty_result
        result_groups = []
        result_group_ids = set()

        max_time = options.get("snuba.search.max-total-chunk-time-seconds")
        time_start = time.time()
        more_results = False

        # Do smaller searches in chunks until we have enough results
        # to answer the query (or hit the end of possible results). We do
        # this because a common case for search is to return 100 groups
        # sorted by `last_seen`, and we want to avoid returning all of
        # a project's groups and then post-sorting them all in Postgres
        # when typically the first N results will do.
        while (time.time() - time_start) < max_time:
            num_chunks += 1

            # grow the chunk size on each iteration to account for huge projects
            # and weird queries, up to a max size
            chunk_limit = min(int(chunk_limit * chunk_growth), max_chunk_size)
            # but if we have group_ids always query for at least that many items
            chunk_limit = max(chunk_limit, len(group_ids))

            # {group_id: group_score, ...}
            snuba_groups, total = self.snuba_search(
                start=start,
                end=end,
                project_ids=[p.id for p in projects],
                environment_ids=environments and [environment.id for environment in environments],
                organization=projects[0].organization,
                sort_field=sort_field,
                cursor=cursor,
                group_ids=group_ids,
                limit=chunk_limit,
                offset=offset,
                search_filters=search_filters,
                referrer=referrer,
                actor=actor,
                aggregate_kwargs=aggregate_kwargs,
            )
            metrics.distribution("snuba.search.num_snuba_results", len(snuba_groups))
            count = len(snuba_groups)
            more_results = count >= limit and (offset + limit) < total
            offset += len(snuba_groups)

            if not snuba_groups:
                break

            if group_ids:
                # pre-filtered candidates were passed down to Snuba, so we're
                # finished with filtering and these are the only results. Note
                # that because we set the chunk size to at least the size of
                # the group_ids, we know we got all of them (ie there are
                # no more chunks after the first)
                result_groups = snuba_groups
                if count_hits and hits is None:
                    hits = len(snuba_groups)
            else:
                # pre-filtered candidates were *not* passed down to Snuba,
                # so we need to do post-filtering to verify Sentry DB predicates
                filtered_group_ids = group_queryset.filter(
                    id__in=[gid for gid, _ in snuba_groups]
                ).values_list("id", flat=True)

                group_to_score = dict(snuba_groups)
                for group_id in filtered_group_ids:
                    if group_id in result_group_ids:
                        # because we're doing multiple Snuba queries, which
                        # happen outside of a transaction, there is a small possibility
                        # of groups moving around in the sort scoring underneath us,
                        # so we at least want to protect against duplicates
                        continue

                    group_score = group_to_score[group_id]
                    result_group_ids.add(group_id)
                    result_groups.append((group_id, group_score))

            # break the query loop for one of three reasons:
            # * we started with Postgres candidates and so only do one Snuba query max
            # * the paginator is returning enough results to satisfy the query (>= the limit)
            # * there are no more groups in Snuba to post-filter
            # TODO: do we actually have to rebuild this SequencePaginator every time
            # or can we just make it after we've broken out of the loop?
            paginator_results = SequencePaginator(
                [(score, id) for (id, score) in result_groups], reverse=True, **paginator_options
            ).get_result(limit, cursor, known_hits=hits, max_hits=max_hits)

            if group_ids or len(paginator_results.results) >= limit or not more_results:
                break

        # HACK: We're using the SequencePaginator to mask the complexities of going
        # back and forth between two databases. This causes a problem with pagination
        # because we're 'lying' to the SequencePaginator (it thinks it has the entire
        # result set in memory when it does not). For this reason we need to make some
        # best guesses as to whether the `prev` and `next` cursors have more results.

        if len(paginator_results.results) == limit and more_results:
            # Because we are going back and forth between DBs there is a small
            # chance that we will hand the SequencePaginator exactly `limit`
            # items. In this case the paginator will assume there are no more
            # results, so we need to override the `next` cursor's results.
            paginator_results.next.has_results = True

        if cursor is not None and (not cursor.is_prev or len(paginator_results.results) > 0):
            # If the user passed a cursor, and it isn't already a 0 result `is_prev`
            # cursor, then it's worth allowing them to go back a page to check for
            # more results.
            paginator_results.prev.has_results = True

        metrics.distribution("snuba.search.num_chunks", num_chunks)

        groups = Group.objects.in_bulk(paginator_results.results)
        paginator_results.results = [groups[k] for k in paginator_results.results if k in groups]

        metrics.timing(
            "snuba.search.query",
            (timezone.now() - now).total_seconds(),
            tags={"postgres_only": False},
        )
        return paginator_results

    def calculate_hits(
        self,
        group_ids: Sequence[int],
        too_many_candidates: bool,
        sort_field: str,
        projects: Sequence[Project],
        retention_window_start: datetime | None,
        group_queryset: Query,
        environments: Sequence[Environment] | None,
        sort_by: str,
        limit: int,
        cursor: Cursor | None,
        count_hits: bool,
        paginator_options: Mapping[str, Any],
        search_filters: Sequence[SearchFilter] | None,
        start: datetime,
        end: datetime,
        actor: Any | None = None,
    ) -> int | None:
        """
        This method should return an integer representing the number of hits (results) of your search.
        It will return 0 if hits were calculated and there are none.
        It will return None if hits were not calculated.
        """
        if count_hits is False:
            return None
        elif too_many_candidates or cursor is not None:
            # If we had too many candidates to reasonably pass down to snuba,
            # or if we have a cursor that bisects the overall result set (such
            # that our query only sees results on one side of the cursor) then
            # we need an alternative way to figure out the total hits that this
            # query has.

            # To do this, we get a sample of groups matching the snuba side of
            # the query, and see how many of those pass the post-filter in
            # postgres. This should give us an estimate of the total number of
            # snuba matches that will be overall matches, which we can use to
            # get an estimate for X-Hits.

            # The sampling is not simple random sampling. It will return *all*
            # matching groups if there are less than N groups matching the
            # query, or it will return a random, deterministic subset of N of
            # the groups if there are more than N overall matches. This means
            # that the "estimate" is actually an accurate result when there are
            # less than N matching groups.

            # The number of samples required to achieve a certain error bound
            # with a certain confidence interval can be calculated from a
            # rearrangement of the normal approximation (Wald) confidence
            # interval formula:
            #
            # https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval
            #
            # Effectively if we want the estimate to be within +/- 10% of the
            # real value with 95% confidence, we would need (1.96^2 * p*(1-p))
            # / 0.1^2 samples. With a starting assumption of p=0.5 (this
            # requires the most samples) we would need 96 samples to achieve
            # +/-10% @ 95% confidence.

            sample_size = options.get("snuba.search.hits-sample-size")
            kwargs = dict(
                start=start,
                end=end,
                project_ids=[p.id for p in projects],
                environment_ids=environments and [environment.id for environment in environments],
                organization=projects[0].organization,
                sort_field=sort_field,
                limit=sample_size,
                offset=0,
                get_sample=True,
                search_filters=search_filters,
                actor=actor,
            )
            if not too_many_candidates:
                kwargs["group_ids"] = group_ids

            snuba_groups, snuba_total = self.snuba_search(**kwargs)
            snuba_count = len(snuba_groups)
            if snuba_count == 0:
                # Maybe check for 0 hits and return EMPTY_RESULT in ::query? self.empty_result
                return 0
            else:
                filtered_count = group_queryset.filter(
                    id__in=[gid for gid, _ in snuba_groups]
                ).count()

                hit_ratio = filtered_count / float(snuba_count)
                hits = int(hit_ratio * snuba_total)
                return hits
        return None


class InvalidQueryForExecutor(Exception):
    pass


class GroupAttributesPostgresSnubaQueryExecutor(PostgresSnubaQueryExecutor):
    logger = logging.getLogger("sentry.search.groupattributessnuba")

    def get_times_seen_filter(
        self, search_filter: SearchFilter, joined_entity: Entity
    ) -> Condition:
        return Condition(
            Function("count", []),
            Op(search_filter.operator),
            search_filter.value.raw_value,
        )

    def get_last_seen_filter(self, search_filter: SearchFilter, joined_entity: Entity) -> Condition:
        # get the max timestamp of the error/search_issue event
        return Condition(
            Function("max", [Column("timestamp", joined_entity)]),
            Op(search_filter.operator),
            search_filter.value.raw_value,
        )

    def get_basic_group_snuba_condition(
        self, search_filter: SearchFilter, joined_entity: Entity
    ) -> Condition:
        """
        Returns the basic lookup for a search filter.
        """
        return Condition(
            Column(f"group_{search_filter.key.name}", self.entities["attrs"]),
            Op(search_filter.operator),
            search_filter.value.raw_value,
        )

    def get_basic_event_snuba_condition(
        self,
        search_filter: SearchFilter,
        joined_entity: Entity,
        snuba_params: SnubaParams,
    ) -> Condition:
        """
        Returns the basic lookup for a search filter.
        """
        dataset = Dataset.Events if joined_entity.name == ENTITY_EVENTS else Dataset.IssuePlatform
        query_builder = UnresolvedQuery(
            dataset=dataset, entity=joined_entity, snuba_params=snuba_params, params={}
        )
        query_builder.start = snuba_params.start
        query_builder.end = snuba_params.end
        return query_builder.convert_search_filter_to_condition(search_filter)

    def get_assigned(
        self, search_filter: SearchFilter, joined_entity: Entity, check_none=True
    ) -> Condition:
        """
        Returns the assigned lookup for a search filter.
        """
        attr_entity = self.entities["attrs"]
        user_ids = [user.id for user in search_filter.value.raw_value if isinstance(user, RpcUser)]
        team_ids = [team.id for team in search_filter.value.raw_value if isinstance(team, Team)]
        operator = Op.NOT_IN if search_filter.is_negation else Op.IN
        # only used when we check for none
        null_check_operator = Op.IS_NULL if search_filter.is_negation else Op.IS_NOT_NULL
        check_for_none = check_none and None in search_filter.value.raw_value

        conditions = []
        if user_ids:
            assigned_to_user = Condition(
                Column("assignee_user_id", attr_entity), operator, user_ids
            )
            if search_filter.is_negation:
                # need to explicitly allow for null values
                assigned_to_user = BooleanCondition(
                    op=BooleanOp.OR,
                    conditions=[
                        assigned_to_user,
                        Condition(Column("assignee_user_id", attr_entity), null_check_operator),
                    ],
                )
            conditions.append(assigned_to_user)

        if team_ids:
            assigned_to_team = Condition(
                Column("assignee_team_id", attr_entity), operator, team_ids
            )
            # need to explicitly allow for null values
            if search_filter.is_negation:
                assigned_to_team = BooleanCondition(
                    op=BooleanOp.OR,
                    conditions=[
                        assigned_to_team,
                        Condition(Column("assignee_team_id", attr_entity), null_check_operator),
                    ],
                )

            conditions.append(assigned_to_team)

        # asking for unassigned issues
        if check_for_none:
            conditions.append(self.get_unassigned(search_filter.is_negation))

        # if one condition, we just use that
        if len(conditions) == 1:
            return conditions[0]

        operator = BooleanOp.AND if search_filter.is_negation else BooleanOp.OR
        return BooleanCondition(op=operator, conditions=conditions)

    def get_unassigned(self, in_negation: bool = False) -> Condition:
        """
        Returns the unassigned lookup for a search filter.
        """
        attr_entity = self.entities["attrs"]
        inner_operator = Op.IS_NOT_NULL if in_negation else Op.IS_NULL
        return BooleanCondition(
            op=BooleanOp.OR if in_negation else BooleanOp.AND,
            conditions=[
                Condition(Column("assignee_user_id", attr_entity), inner_operator),
                Condition(Column("assignee_team_id", attr_entity), inner_operator),
            ],
        )

    def get_unassigned_condition(
        self,
        search_filter: SearchFilter,
        attr_entity: Entity,
    ) -> Condition:
        is_assigned = search_filter.value.raw_value is False
        is_negation = search_filter.is_negation

        check_assigned = (is_assigned and not is_negation) or (not is_assigned and is_negation)
        if check_assigned:
            return BooleanCondition(
                op=BooleanOp.OR,
                conditions=[
                    Condition(Column("assignee_user_id", attr_entity), Op.IS_NOT_NULL),
                    Condition(Column("assignee_team_id", attr_entity), Op.IS_NOT_NULL),
                ],
            )
        return BooleanCondition(
            op=BooleanOp.AND,
            conditions=[
                Condition(Column("assignee_user_id", attr_entity), Op.IS_NULL),
                Condition(Column("assignee_team_id", attr_entity), Op.IS_NULL),
            ],
        )

    def get_suggested(self, search_filter: SearchFilter) -> Condition:
        """
        Returns the suggested lookup for a search filter.
        """
        attr_entity = self.entities["attrs"]
        users = filter(lambda x: isinstance(x, RpcUser), search_filter.value.raw_value)
        user_ids = [user.id for user in users]
        teams = filter(lambda x: isinstance(x, Team), search_filter.value.raw_value)
        team_ids = [team.id for team in teams]

        operator = Op.NOT_IN if search_filter.is_negation else Op.IN
        null_check_operator = Op.IS_NULL if search_filter.is_negation else Op.IS_NOT_NULL

        conditions = []
        if user_ids:
            suspect_commit_user = Condition(
                Column("owner_suspect_commit_user_id", attr_entity), operator, user_ids
            )
            ownership_rule_user = Condition(
                Column("owner_ownership_rule_user_id", attr_entity), operator, user_ids
            )
            codeowner_user = Condition(
                Column("owner_codeowners_user_id", attr_entity), operator, user_ids
            )

            # need to explicitly allow for null values if we are negating
            if search_filter.is_negation:
                suspect_commit_user = BooleanCondition(
                    op=BooleanOp.OR,
                    conditions=[
                        suspect_commit_user,
                        Condition(
                            Column("owner_suspect_commit_user_id", attr_entity), null_check_operator
                        ),
                    ],
                )
                ownership_rule_user = BooleanCondition(
                    op=BooleanOp.OR,
                    conditions=[
                        ownership_rule_user,
                        Condition(
                            Column("owner_ownership_rule_user_id", attr_entity), null_check_operator
                        ),
                    ],
                )
                codeowner_user = BooleanCondition(
                    op=BooleanOp.OR,
                    conditions=[
                        codeowner_user,
                        Condition(
                            Column("owner_codeowners_user_id", attr_entity), null_check_operator
                        ),
                    ],
                )
            conditions = conditions + [suspect_commit_user, ownership_rule_user, codeowner_user]

        if team_ids:
            ownership_rule_team = Condition(
                Column("owner_ownership_rule_team_id", attr_entity), operator, team_ids
            )
            codowner_team = Condition(
                Column("owner_codeowners_team_id", attr_entity), operator, team_ids
            )
            # need to explicitly allow for null values if we are negating
            if search_filter.is_negation:
                ownership_rule_team = BooleanCondition(
                    op=BooleanOp.OR,
                    conditions=[
                        ownership_rule_team,
                        Condition(
                            Column("owner_ownership_rule_team_id", attr_entity),
                            null_check_operator,
                            None,
                        ),
                    ],
                )
                codowner_team = BooleanCondition(
                    op=BooleanOp.OR,
                    conditions=[
                        codowner_team,
                        Condition(
                            Column("owner_codeowners_team_id", attr_entity),
                            null_check_operator,
                            None,
                        ),
                    ],
                )
            conditions = conditions + [ownership_rule_team, codowner_team]

        return BooleanCondition(
            op=BooleanOp.AND if search_filter.is_negation else BooleanOp.OR,
            conditions=conditions,
        )

    def get_unsuggested(self, in_negation: bool = False) -> Condition:
        attr_entity = self.entities["attrs"]
        inner_operator = Op.IS_NOT_NULL if in_negation else Op.IS_NULL
        # neither assigned to team or user
        suspect_commit_user = Condition(
            Column("owner_suspect_commit_user_id", attr_entity), inner_operator
        )
        ownership_rule_user = Condition(
            Column("owner_ownership_rule_user_id", attr_entity), inner_operator
        )
        ownership_rule_team = Condition(
            Column("owner_ownership_rule_team_id", attr_entity), inner_operator
        )
        codeowner_user = Condition(Column("owner_codeowners_user_id", attr_entity), inner_operator)
        codowner_team = Condition(Column("owner_codeowners_team_id", attr_entity), inner_operator)
        return BooleanCondition(
            op=BooleanOp.OR if in_negation else BooleanOp.AND,
            conditions=[
                suspect_commit_user,
                ownership_rule_user,
                ownership_rule_team,
                codeowner_user,
                codowner_team,
            ],
        )

    def get_assigned_or_suggested(
        self, search_filter: SearchFilter, joined_entity: Entity
    ) -> Condition:
        # we or the conditions when they are not none
        top_level_conditions = []

        # if we are looking for things other than just none
        if search_filter.value.raw_value != [None]:
            condition_assigned_not_none = self.get_assigned(
                search_filter, joined_entity, check_none=False
            )
            condition_suggested_not_none = self.get_suggested(search_filter)

            condition_assigned_or_suggested_not_none = BooleanCondition(
                op=BooleanOp.AND if search_filter.is_negation else BooleanOp.OR,
                conditions=[condition_assigned_not_none, condition_suggested_not_none],
            )
            top_level_conditions.append(condition_assigned_or_suggested_not_none)

        if None in search_filter.value.raw_value:
            # for the none case, we need to make sure its not assigned OR suggested
            condition_assigned_none = self.get_unassigned(search_filter.is_negation)
            condition_suggested_none = self.get_unsuggested(search_filter.is_negation)
            condition_assigned_or_suggested_none = BooleanCondition(
                op=BooleanOp.OR if search_filter.is_negation else BooleanOp.AND,
                conditions=[condition_assigned_none, condition_suggested_none],
            )
            top_level_conditions.append(condition_assigned_or_suggested_none)

        # if one condition, we just use that
        if len(top_level_conditions) == 1:
            return top_level_conditions[0]

        return BooleanCondition(
            op=BooleanOp.AND if search_filter.is_negation else BooleanOp.OR,
            conditions=top_level_conditions,
        )

    sort_strategies = {
        "new": "first_seen_score",
        "date": "last_seen_score",
        "freq": "times_seen",
        "user": "user_count",
    }

    def get_last_seen_aggregation(self, joined_entity: Entity) -> Function:
        return Function(
            "ifNull",
            [
                Function(
                    "multiply",
                    [
                        Function(
                            "toUInt64",
                            [Function("max", [Column("timestamp", joined_entity)])],
                        ),
                        1000,
                    ],
                ),
                0,
            ],
            alias=self.sort_strategies["date"],
        )

    def get_first_seen_aggregation(self) -> Function:
        return Function(
            "ifNull",
            [
                Function(
                    "multiply",
                    [
                        Function(
                            "toUInt64",
                            [Function("max", [Column("group_first_seen", self.entities["attrs"])])],
                        ),
                        1000,
                    ],
                ),
                0,
            ],
            alias=self.sort_strategies["new"],
        )

    def get_handled_condition(
        self, search_filter: SearchFilter, joined_entity: Entity
    ) -> Condition:
        """
        Returns the handled and unhandled lookup for a search filter.
        Does not use the functions that Snuba has, instead replicates that logic
        and queries the exception_stacks.mechanism_handled colunn directly
        """
        if search_filter.key.name == "error.handled":
            check_handled = search_filter.value.raw_value == 1
        elif search_filter.key.name == "error.unhandled":
            check_handled = search_filter.value.raw_value == 0

        if check_handled:
            outer_function_operator = "arrayAll"
            inner_function_operator = "or"
            is_null_check = "isNull"
            inner_equality_check = "notEquals"
        else:
            outer_function_operator = "arrayExists"
            inner_function_operator = "and"
            is_null_check = "isNotNull"
            inner_equality_check = "equals"

        return Condition(
            Function(
                outer_function_operator,
                [
                    Lambda(
                        ["x"],
                        Function(
                            inner_function_operator,
                            [
                                Function(is_null_check, [Identifier("x")]),
                                Function(
                                    inner_equality_check,
                                    [Function("assumeNotNull", [Identifier("x")]), 0],
                                ),
                            ],
                        ),
                    ),
                    Column("exception_stacks.mechanism_handled", joined_entity),
                ],
            ),
            Op.EQ,
            1,
        )

    def get_priority_condition(
        self, search_filter: SearchFilter, joined_entity: Entity
    ) -> Condition:
        """
        Returns the priority lookup for a search filter.
        """
        return Condition(
            Column("group_priority", self.entities["attrs"]), Op.IN, search_filter.value.raw_value
        )

    def get_first_release_condition(
        self, search_filter: SearchFilter, projects: list[Project]
    ) -> Condition:
        """
        Returns the first_release lookup for a search filter.
        """
        versions = search_filter.value.raw_value
        releases = {
            version: release_id
            for version, release_id in Release.objects.filter(
                organization=projects[0].organization_id, version__in=versions
            ).values_list("version", "id")
        }

        for version in versions:
            if version not in releases:
                # TODO: This is mostly around for legacy reasons - we should probably just
                # raise a validation here an inform the user that they passed an invalid
                # release
                releases[None] = -1
                # We only need to find the first non-existent release here
                break

        return Condition(
            Column("group_first_release", self.entities["attrs"]),
            Op.IN,
            list(releases.values()),
        )

    ISSUE_FIELD_NAME = "group_id"

    entities = {
        "event": Entity(ENTITY_EVENTS, alias="e"),
        "attrs": Entity(ENTITY_GROUP_ATTRIBUTES, alias="g"),
        "search_issues": Entity(ENTITY_SEARCH_ISSUES, alias="si"),
    }

    group_conditions_lookup = {
        "status": (get_basic_group_snuba_condition, Clauses.WHERE),
        "substatus": (get_basic_group_snuba_condition, Clauses.WHERE),
        "assigned_or_suggested": (get_assigned_or_suggested, Clauses.WHERE),
        "assigned_to": (get_assigned, Clauses.WHERE),
        "unassigned": (get_unassigned_condition, Clauses.WHERE),
        "first_seen": (get_basic_group_snuba_condition, Clauses.WHERE),
        "last_seen": (get_last_seen_filter, Clauses.HAVING),
        "times_seen": (get_times_seen_filter, Clauses.HAVING),
        "error.handled": (get_handled_condition, Clauses.WHERE),
        "error.unhandled": (get_handled_condition, Clauses.WHERE),
        "issue.priority": (get_priority_condition, Clauses.WHERE),
        "first_release": (get_first_release_condition, Clauses.WHERE),
        "firstRelease": (get_first_release_condition, Clauses.WHERE),
    }

    def get_sort_defs(self, entity):
        return {
            "date": self.get_last_seen_aggregation(entity),
            "new": self.get_first_seen_aggregation(),
            "freq": Function("count", [], alias=self.sort_strategies["freq"]),
            "user": Function(
                "uniq", [Column("tags[sentry:user]", entity)], self.sort_strategies["user"]
            ),
        }

    def should_check_search_issues(
        self, group_categories: Sequence[str], search_filters: Sequence[SearchFilter]
    ) -> bool:
        # not in the group categories we are looking for
        if not any([GroupCategory.ERROR.value != gc for gc in group_categories]):
            return False
        # error/stacktrace info doesn't exist exist in search_issues so we shouldn't it at all
        bad_prefix_list = ["error.", "stack."]
        for filter in search_filters:
            if any(filter.key.name.startswith(bad_prefix) for bad_prefix in bad_prefix_list):
                return False
        return True

    def calculate_start_end(
        self,
        retention_window_start: datetime | None,
        search_filters: Sequence[SearchFilter] | None,
        date_from: datetime | None,
        date_to: datetime | None,
    ) -> tuple[datetime, datetime, datetime]:
        now = timezone.now()
        end = None
        end_params = [_f for _f in [date_to, get_search_filter(search_filters, "date", "<")] if _f]
        if end_params:
            end = min(end_params)

        if not end:
            end = now + ALLOWED_FUTURE_DELTA

        retention_date = max(_f for _f in [retention_window_start, now - timedelta(days=90)] if _f)
        start_params = [date_from, retention_date, get_search_filter(search_filters, "date", ">")]
        start = max(_f for _f in start_params if _f)
        end = max([retention_date, end])
        return start, end, retention_date

    @metrics.wraps("snuba.search.group_attributes.query")
    def query(
        self,
        projects: Sequence[Project],
        retention_window_start: datetime | None,
        group_queryset: BaseQuerySet,
        environments: Sequence[Environment] | None,
        sort_by: str,
        limit: int,
        cursor: Cursor | None,
        count_hits: bool,
        paginator_options: Mapping[str, Any] | None,
        search_filters: Sequence[SearchFilter] | None,
        date_from: datetime | None,
        date_to: datetime | None,
        max_hits: int | None = None,
        referrer: str | None = None,
        actor: User | RpcUser | None = None,
        aggregate_kwargs: TrendsSortWeights | None = None,
        use_group_snuba_dataset: bool = False,
    ) -> CursorResult[Group]:
        start, end, retention_date = self.calculate_start_end(
            retention_window_start, search_filters, date_from, date_to
        )

        if start == retention_date and end == retention_date:
            # Both `start` and `end` must have been trimmed to `retention_date`,
            # so this entire search was against a time range that is outside of
            # retention. We'll return empty results to maintain backwards compatibility
            # with Django search (for now).
            return self.empty_result

        if start >= end:
            # TODO: This maintains backwards compatibility with Django search, but
            # in the future we should find a way to notify the user that their search
            # is invalid.
            return self.empty_result

        if len(projects) == 0:
            return self.empty_result

        # Check if any search filters are in POSTGRES_ONLY_SEARCH_FIELDS
        search_filters = search_filters or ()
        group_ids_to_pass_to_snuba = None
        too_many_candidates = False
        max_candidates = options.get("snuba.search.max-pre-snuba-candidates")
        with sentry_sdk.start_span(op="snuba_group_attributes_query") as span:
            if any(sf.key.name in POSTGRES_ONLY_SEARCH_FIELDS for sf in search_filters):
                group_ids_to_pass_to_snuba = list(
                    group_queryset.using_replica().values_list("id", flat=True)[
                        : max_candidates + 1
                    ]
                )
                span.set_data("Max Candidates", max_candidates)
                span.set_data("Result Size", len(group_ids_to_pass_to_snuba))

                if too_many_candidates := (len(group_ids_to_pass_to_snuba) > max_candidates):
                    metrics.incr(
                        "snuba.search.group_attributes.too_many_candidates", skip_internal=False
                    )
                    group_ids_to_pass_to_snuba = None

        # remove the search filters that are only for postgres
        search_filters = [
            sf for sf in search_filters if sf.key.name not in POSTGRES_ONLY_SEARCH_FIELDS
        ]

        organization = projects[0].organization

        event_entity = self.entities["event"]
        attr_entity = self.entities["attrs"]
        search_issues_entity = self.entities["search_issues"]

        queries = []
        entities_to_check = []
        group_categories = group_categories_from_search_filters(search_filters, organization, actor)

        if GroupCategory.ERROR.value in group_categories:
            entities_to_check.append(event_entity)

        # check we have non-error categories to search for
        if self.should_check_search_issues(group_categories, search_filters):
            entities_to_check.append(search_issues_entity)

        for joined_entity in entities_to_check:
            is_errors = joined_entity.name == ENTITY_EVENTS
            where_conditions = [
                Condition(Column("project_id", joined_entity), Op.IN, [p.id for p in projects]),
                Condition(Column("project_id", attr_entity), Op.IN, [p.id for p in projects]),
                Condition(Column("timestamp", joined_entity), Op.GTE, start),
                Condition(Column("timestamp", joined_entity), Op.LT, end),
            ]

            having = []
            # if we need to prefetch from postgres, we add filter by the group ids
            if group_ids_to_pass_to_snuba is not None:
                # will not find any matches, we can return early
                if len(group_ids_to_pass_to_snuba) == 0:
                    metrics.incr("snuba.search.group_attributes.no_candidates", skip_internal=False)
                    return self.empty_result

                # limit groups and events to the group ids
                for entity_with_group_id in [attr_entity, joined_entity]:
                    where_conditions.append(
                        Condition(
                            Column("group_id", entity_with_group_id),
                            Op.IN,
                            group_ids_to_pass_to_snuba,
                        )
                    )

            for search_filter in search_filters or ():
                # use the stored function if it exists in our mapping, otherwise use the basic lookup
                lookup = self.group_conditions_lookup.get(search_filter.key.name)
                fn = lookup[0] if lookup else None
                clause = lookup[1] if lookup else Clauses.WHERE

                # issue.category and issue.type are handled specially
                # we handle the date filter with calculate_start_end
                if search_filter.key.name in ["issue.category", "issue.type", "date"]:
                    pass
                # handle first_release filter separately
                elif search_filter.key.name in FIRST_RELEASE_FILTERS:
                    where_conditions.append(
                        self.get_first_release_condition(search_filter, projects)
                    )
                elif search_filter.key.name == "unassigned":
                    where_conditions.append(
                        self.get_unassigned_condition(search_filter, attr_entity)
                    )
                elif fn:
                    # dynamic lookup of what clause to use
                    if clause == Clauses.WHERE:
                        where_conditions.append(fn(self, search_filter, joined_entity))
                    elif clause == Clauses.HAVING:
                        having.append(fn(self, search_filter, joined_entity))
                    else:
                        raise InvalidQueryForExecutor(f"Invalid clause {clause}")
                else:
                    condition = self.get_basic_event_snuba_condition(
                        search_filter,
                        joined_entity,
                        SnubaParams(
                            organization=organization,
                            projects=projects,
                            user=actor,
                            start=start,
                            end=end,
                            environments=environments,
                            teams=[],  # may need to change, tbd
                        ),
                    )
                    if condition is not None:
                        if features.has(
                            "organizations:feature-flag-autocomplete", organization
                        ) and has_tags_filter(condition.lhs):
                            feature_condition = Condition(
                                lhs=substitute_tags_filter(condition.lhs),
                                op=condition.op,
                                rhs=condition.rhs,
                            )
                            condition = Or(conditions=[condition, feature_condition])

                        where_conditions.append(condition)

            # handle types based on issue.type and issue.category
            if not is_errors:
                raw_group_types = group_types_from(search_filters)
                # no possible groups, return empty
                if len(raw_group_types) == 0:
                    metrics.incr(
                        "snuba.search.group_attributes.no_possible_groups", skip_internal=False
                    )
                    return self.empty_result

                # filter out the group types that are not visible to the org/user
                group_types = [
                    gt.type_id
                    for gt in grouptype.registry.get_visible(organization, actor)
                    if gt.type_id in raw_group_types
                ]
                where_conditions.append(
                    Condition(Column("occurrence_type_id", joined_entity), Op.IN, group_types)
                )

            if environments:
                where_conditions.append(
                    Condition(
                        Column("environment", joined_entity), Op.IN, [e.name for e in environments]
                    )
                )

            sort_func = self.get_sort_defs(joined_entity)[sort_by]

            if cursor is not None:
                op = Op.GTE if cursor.is_prev else Op.LTE
                having.append(Condition(sort_func, op, cursor.value))

            tenant_ids = {"organization_id": projects[0].organization_id} if projects else None
            groupby = [Column("group_id", attr_entity)]
            select = [Column("group_id", attr_entity)]
            if sort_by == "new":
                groupby.append(Column("group_first_seen", attr_entity))
                select.append(Column("group_first_seen", attr_entity))

            select.append(sort_func)

            query = Query(
                match=Join([Relationship(joined_entity, "attributes_inner", attr_entity)]),
                select=select,
                where=where_conditions,
                groupby=groupby,
                having=having,
                orderby=[
                    OrderBy(dataclasses.replace(sort_func, alias=None), direction=Direction.DESC)
                ],
                limit=Limit(min(limit + 1, MAX_SNUBA_ELEMENTS)),
            )
            dataset = Dataset.Events.value if is_errors else Dataset.IssuePlatform.value
            request = Request(
                dataset=dataset,
                app_id="group_attributes",
                query=query,
                tenant_ids=tenant_ids,
            )
            queries.append(request)

            if count_hits:
                hits_query = Query(
                    match=Join([Relationship(joined_entity, "attributes_inner", attr_entity)]),
                    select=[
                        Function("uniq", [Column("group_id", attr_entity)], alias="count"),
                    ],
                    where=where_conditions,
                )
                request = Request(
                    dataset=dataset,
                    app_id="group_attributes",
                    query=hits_query,
                    tenant_ids=tenant_ids,
                )
                queries.append(request)

        bulk_result = snuba.bulk_snuba_queries(
            queries, referrer="search.snuba.group_attributes_search.query"
        )

        data = []
        count: int = 0
        # get the query data and the query counts
        k = 0
        for _ in range(len(entities_to_check)):
            data.extend(bulk_result[k]["data"])
            if count_hits:
                k += 1
                count += bulk_result[k]["data"][0]["count"]
            k += 1

        metrics.distribution("snuba.search.group_attributes.num_snuba_results", len(data))

        if too_many_candidates:
            # If we had too many candidates to reasonably pass down to snuba,
            # we need to apply the Postgres filter as a post-filtering step.
            filtered_group_ids = group_queryset.filter(
                id__in=[group["g.group_id"] for group in data]
            ).values_list("id", flat=True)

            data = [group for group in data if group["g.group_id"] in filtered_group_ids]

        paginator_results = SequencePaginator(
            [(row[self.sort_strategies[sort_by]], row["g.group_id"]) for row in data],
            reverse=True,
            **paginator_options,
        ).get_result(limit, cursor, known_hits=count, max_hits=max_hits)

        # TODO: do we need to set has_results for the next cursor?

        if cursor is not None and (not cursor.is_prev or len(paginator_results.results) > 0):
            # If the user passed a cursor, and it isn't already a 0 result `is_prev`
            # cursor, then it's worth allowing them to go back a page to check for
            # more results.
            paginator_results.prev.has_results = True

        # We filter against `group_queryset` here to ensure we only return groups that aren't being migrated
        # or being deleted before snuba is updated. This can result in us returning less than a full page of
        # results, but we can't do much about that without a more complex solution such as asking for more results
        # In practice, this will likely only skip a couple of results at worst, and
        # probably not be noticeable to the user, so holding off for now to reduce complexity.

        groups = group_queryset.in_bulk(paginator_results.results)
        paginator_results.results = [groups[k] for k in paginator_results.results if k in groups]
        # TODO: Add types to paginators and remove this
        return cast(CursorResult[Group], paginator_results)


# This should update the search box so we can fetch the correct
# issues.
def has_tags_filter(condition: Column | Function) -> bool:
    if isinstance(condition, Column):
        if (
            condition.entity.name == "events"
            and condition.name.startswith("tags[")
            and condition.name.endswith("]")
        ):
            return True
    elif isinstance(condition, Function):
        for parameter in condition.parameters:
            if isinstance(parameter, (Column, Function)):
                return has_tags_filter(parameter)
    return False


def substitute_tags_filter(condition: Column | Function) -> bool:
    if isinstance(condition, Column):
        if condition.name.startswith("tags[") and condition.name.endswith("]"):
            return Column(
                name=f"flags[{condition.name[5:-1]}]",
                entity=condition.entity,
            )
    elif isinstance(condition, Function):
        for parameter in condition.parameters:
            if isinstance(parameter, (Column, Function)):
                return substitute_tags_filter(parameter)
    return condition
