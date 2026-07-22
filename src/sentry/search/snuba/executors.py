from __future__ import annotations

import functools
import logging
import time
from abc import ABCMeta, abstractmethod
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from datetime import datetime, timedelta
from enum import Enum, auto
from hashlib import md5
from math import floor
from typing import Any, TypedDict, cast

import sentry_sdk
from django.db.models import F
from django.utils import timezone
from snuba_sdk.query import Query

from sentry import features, options
from sentry.api.event_search import SearchFilter
from sentry.api.paginator import DateTimePaginator, Paginator, SequencePaginator
from sentry.api.serializers.models.group import SKIP_SNUBA_FIELDS
from sentry.constants import ALLOWED_FUTURE_DELTA
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.issues.grouptype import GroupCategory
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.issues.progress import IssueProgressState, get_group_progress_states
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
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.eap.occurrences.search_executor import EAP_SORT_STRATEGIES, run_eap_group_search
from sentry.search.events.filter import convert_search_filter_to_snuba_query, format_search_filter
from sentry.snuba.dataset import Dataset
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils import json, metrics
from sentry.utils.cursors import Cursor, CursorResult
from sentry.utils.snuba import (
    EmptyGroupIdIntersectionError,
    SnubaQueryParams,
    aliased_query_params,
    bulk_raw_query,
)
from sentry.utils.tracing import set_span_data, start_span

logger = logging.getLogger(__name__)

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


@dataclass(frozen=True)
class PostgresSortStrategy:
    """A sort strategy that uses Postgres Group model data, optionally combined with Snuba."""

    postgres_fields: dict[str, str]
    snuba_aggregations: list[str] = dataclass_field(default_factory=list)
    # Computed signals that aren't a single Group column (e.g. assignment affinity).
    # Each resolver is called once in bulk with (actor, organization, projects, group_ids)
    # and returns {group_id: value}; the value is merged into the score_fn dict under its key.
    signal_resolvers: dict[
        str, Callable[[Any, Organization, Sequence[Project], list[int]], dict[int, Any]]
    ] = dataclass_field(default_factory=dict)
    score_fn: Callable[[dict[str, Any]], float] = lambda data: 0.0
    # Score to use when score_fn raises on a row. Dropping the row would make the issue
    # vanish from the stream entirely; instead we keep it with a base score (e.g. the
    # Snuba recommended value) so it still appears, just without the boosts score_fn adds.
    fallback_score_fn: Callable[[dict[str, Any]], float] = lambda data: 0.0
    exclude_null_postgres: bool = True
    # Optional cap-free path: return (queryset, order_by_key) for a native Postgres ORDER BY
    # so the sort can page past the in-memory candidate cap. None for Snuba-blended strategies
    # (e.g. recommended_v2) whose ordering can't be expressed entirely in Postgres.
    native_order_by: Callable[[BaseQuerySet], tuple[BaseQuerySet, str]] | None = None


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
ENTITY_SEARCH_ISSUES = "search_issues"


def _reasonable_search_result_match(
    control: tuple[list[tuple[int, Any]], int],
    experimental: tuple[list[tuple[int, Any]], int],
) -> bool:
    control_group_ids = {gid for gid, _ in control[0]}
    experimental_group_ids = {gid for gid, _ in experimental[0]}

    if not experimental_group_ids:
        return True

    return experimental_group_ids.issubset(control_group_ids)


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


def group_categories_from_search_filters(search_filters: Sequence[SearchFilter]) -> set[int]:
    group_categories = group_categories_from(search_filters)

    if not group_categories:
        group_categories = set(get_search_strategies().keys())
        # Hide certain categories from the default issue stream
        group_categories.discard(GroupCategory.FEEDBACK.value)
        group_categories.discard(GroupCategory.CONFIGURATION.value)

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
    def aggregation_defs(self) -> Mapping[str, Sequence[str] | Callable]:
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
        actor: Any | None = None,
        aggregate_kwargs: TrendsSortWeights | None = None,
        *,
        referrer: str,
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
        use_issue_platform: bool = False,
    ) -> list[Any]:
        extra_aggregations = self.dependency_aggregations.get(sort_field, [])
        required_aggregations = set([sort_field, "total"] + extra_aggregations)
        for h in having:
            alias = h[0]
            required_aggregations.add(alias)

        aggregations = []
        for alias in required_aggregations:
            aggregation = self.aggregation_defs[alias]
            if use_issue_platform and alias in ("trends", "recommended"):
                aggregation = self.aggregation_defs[f"{alias}_issue_platform"]
            if callable(aggregation):
                if aggregate_kwargs:
                    aggregation = aggregation(start, end, aggregate_kwargs.get(alias, {}))
                else:
                    aggregation = aggregation(start, end, DEFAULT_TRENDS_WEIGHTS)
            aggregations.append(list(aggregation) + [alias])

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

        use_issue_platform = group_category is not GroupCategory.ERROR.value
        aggregations = self._prepare_aggregations(
            sort_field, start, end, having, aggregate_kwargs, use_issue_platform
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
            organization,
            list(project_ids),
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
        actor: Any | None = None,
        aggregate_kwargs: TrendsSortWeights | None = None,
        *,
        referrer: str,
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
            if sf.key.name not in self.postgres_only_fields.union(["date", "timestamp"])
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

        group_categories = group_categories_from_search_filters(search_filters or ())

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
            except EmptyGroupIdIntersectionError:
                # Postgres candidates and the snuba group_id condition are
                # disjoint for this category — it can't match anything. Skip it.
                pass
            else:
                if query_params is not None:
                    query_params_for_categories[gc] = query_params

        callsite = "PostgresSnubaQueryExecutor.snuba_search"

        def _run_snuba_query() -> tuple[list[tuple[int, Any]], int]:
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
                        [query_params_for_categories[GroupCategory.ERROR.value]],
                        referrer=referrer,
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

            effective_sort_field = "sample" if get_sample else sort_field
            return [(row["group_id"], row[effective_sort_field]) for row in rows], total  # type: ignore[literal-required]

        def _run_eap_query() -> tuple[list[tuple[int, Any]], int]:
            try:
                return run_eap_group_search(
                    start=start,
                    end=end,
                    project_ids=project_ids,
                    environment_ids=environment_ids,
                    sort_field=sort_field,
                    organization=organization,
                    cursor=cursor,
                    group_ids=group_ids,
                    limit=limit,
                    offset=offset,
                    search_filters=snuba_search_filters,
                    referrer=referrer,
                )
            except Exception:
                logger.exception(
                    "eap.double_read.run_eap_group_search_failed",
                    extra={"callsite": callsite, "sort_field": sort_field},
                )
                return ([], 0)

        # Double-read from EAP for supported sort strategies
        if (
            not get_sample
            and sort_field in EAP_SORT_STRATEGIES
            and features.has("organizations:issue-feed.eap-search", organization)
        ):
            try:
                return EAPOccurrencesComparator.check_and_choose_with_timings(
                    control_data_func=_run_snuba_query,
                    experimental_data_func=_run_eap_query,
                    callsite=callsite,
                    null_result_determiner=lambda r: len(r[0]) == 0,
                    reasonable_match_comparator=_reasonable_search_result_match,
                    debug_context={
                        "sort_field": sort_field,
                        "organization_id": organization.id,
                        "num_group_ids": len(group_ids) if group_ids else 0,
                        "num_filters": len(snuba_search_filters),
                    },
                )
            except Exception:
                logger.exception(
                    "eap.double_read.snuba_search_failed",
                    extra={"callsite": callsite, "sort_field": sort_field},
                )

        return _run_snuba_query()

    def has_sort_strategy(self, sort_by: str) -> bool:
        return sort_by in self.sort_strategies or sort_by in getattr(
            self, "postgres_sort_strategies", {}
        )


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


def _recommended_aggregation(
    timestamp_column: str, type_column: str | None = None
) -> Sequence[str]:
    hour = 3600

    # Recency: exponential decay based on time since last event (24hr halflife)
    recency_weight = options.get("snuba.search.recommended.recency-weight")
    age_hours = f"divide(minus(now(), max({timestamp_column})), {hour})"
    recency = f"divide(1, pow(2, divide({age_hours}, 24)))"

    # Spike: ratio of recent 6hr events to total 3d events
    spike_weight = options.get("snuba.search.recommended.spike-weight")
    recent_6h = f"countIf(lessOrEquals(minus(now(), {timestamp_column}), {6 * hour}))"
    total_3d = f"countIf(lessOrEquals(minus(now(), {timestamp_column}), {3 * 24 * hour}))"
    spike = f"least(1.0, divide({recent_6h}, plus({total_3d}, 1)))"

    # Severity: max log level - maps fatal=1.0, error=0.75, warning=0.5, info=0.25, debug=0.0
    severity_weight = options.get("snuba.search.recommended.severity-weight")
    severity = (
        "max(multiIf("
        "equals(level, 'fatal'), 1.0, "
        "equals(level, 'error'), 0.75, "
        "equals(level, 'warning'), 0.5, "
        "equals(level, 'info'), 0.25, "
        "0.0))"
    )

    # User impact: ln(uniq(tags[sentry:user]) + 1)/ln(1001) - maps 1→~0, 10→0.33, 100→0.67, 1000→1.0
    user_impact_weight = options.get("snuba.search.recommended.user-impact-weight")
    user_impact = "least(1.0, divide(log(plus(uniq(tags[sentry:user]), 1)), log(1001)))"

    # Event volume: ln(count() + 1)/ln(10001) - maps 1→~0, 10→0.25, 100→0.50, 1000→0.75, 10000+→1.0
    event_volume_weight = options.get("snuba.search.recommended.event-volume-weight")
    event_volume = "least(1.0, divide(log(plus(count(), 1)), log(10001)))"

    # Group type boost: additive signal per issue type
    group_type_boosts = options.get("snuba.search.recommended.group-type-boost")

    # Message penalty: downranks capture_message issues (no exception/stacktrace).
    # Subtracted from the score below, and only on the events dataset -- issue-platform
    # occurrences don't have exception_stacks.
    message_penalty_weight = options.get("snuba.search.recommended.message-penalty-weight")

    # Skip zero-weighted factors: their term is always 0, so computing them in
    # ClickHouse is wasted work -- especially expensive aggregates like user
    # impact's uniq(tags[sentry:user]).
    terms = [
        f"multiply({weight}, {factor})"
        for weight, factor in (
            (recency_weight, recency),
            (spike_weight, spike),
            (severity_weight, severity),
            (user_impact_weight, user_impact),
            (event_volume_weight, event_volume),
        )
        if weight
    ]

    if not terms:
        # The score must be an aggregate expression. Every factor term above is an
        # aggregate, but if all are dropped the only remaining term may be the boost
        # below, which can be a bare constant. Seed a constant-0 aggregate so the
        # expression Snuba receives always contains one.
        terms.append("multiply(0, count())")

    if group_type_boosts:
        type_expr = f"any({type_column})" if type_column else "1"
        conditions = []
        for type_id, boost in group_type_boosts.items():
            conditions.append(f"equals({type_expr}, {type_id}), {boost}")
        terms.append(f"multiIf({', '.join(conditions)}, 0.0)")

    score_expr = terms[0]
    for term in terms[1:]:
        score_expr = f"plus({score_expr}, {term})"

    if type_column is None and message_penalty_weight:
        has_exception_ratio = "divide(countIf(notEmpty(exception_stacks.type)), count())"
        message_penalty = f"multiply({message_penalty_weight}, minus(1.0, {has_exception_ratio}))"
        score_expr = f"minus({score_expr}, {message_penalty})"

    return [score_expr, ""]


def recommended_aggregation(
    start: datetime,
    end: datetime,
    aggregate_kwargs: Any = None,
) -> Sequence[str]:
    return _recommended_aggregation(timestamp_column="timestamp")


def recommended_issue_platform_aggregation(
    start: datetime,
    end: datetime,
    aggregate_kwargs: Any = None,
) -> Sequence[str]:
    return _recommended_aggregation(
        timestamp_column="client_timestamp", type_column="occurrence_type_id"
    )


# Seer agent progress stages, mirroring the `issue.agent` search filter
# (ISSUE_AGENT_TO_ACTIVITY_TYPES in sentry.issues.issue_search). A group's signal is
# the furthest stage reached, normalized to [0, 1].
ISSUE_AGENT_STAGE_SIGNALS: dict[int, float] = {
    ActivityType.SEER_RCA_COMPLETED.value: 0.25,
    ActivityType.SEER_SOLUTION_COMPLETED.value: 0.5,
    ActivityType.SEER_CODING_COMPLETED.value: 0.75,
    ActivityType.SEER_PR_CREATED.value: 1.0,
}


def resolve_assignment_signal(
    actor: Any | None, organization: Organization, projects: Sequence[Project], group_ids: list[int]
) -> dict[int, float]:
    """Assignment affinity for the viewer: 1.0 for groups assigned directly to them,
    0.5 for groups assigned to one of their teams, absent otherwise."""
    if actor is None or not getattr(actor, "is_authenticated", False):
        return {}
    assignments = list(
        GroupAssignee.objects.filter(group_id__in=group_ids).values_list(
            "group_id", "user_id", "team_id"
        )
    )
    team_ids: set[int] = set()
    if any(team_id is not None for _, _, team_id in assignments):
        team_ids = {team.id for team in Team.objects.get_for_user(organization, actor)}
    signal: dict[int, float] = {}
    for group_id, user_id, team_id in assignments:
        if user_id is not None and user_id == actor.id:
            signal[group_id] = 1.0
        elif team_id is not None and team_id in team_ids:
            signal[group_id] = 0.5
    return signal


def resolve_suspect_commit_signal(
    actor: Any | None, organization: Organization, projects: Sequence[Project], group_ids: list[int]
) -> dict[int, float]:
    """1.0 for groups where the viewer authored the suspect commit. Unlike assignment,
    suspect-commit ownership isn't auto-assigned by default, so this surfaces issues the
    viewer likely introduced even when they're unassigned or assigned elsewhere."""
    if actor is None or not getattr(actor, "is_authenticated", False):
        return {}
    owned = GroupOwner.objects.filter(
        group_id__in=group_ids,
        type=GroupOwnerType.SUSPECT_COMMIT.value,
        user_id=actor.id,
    ).values_list("group_id", flat=True)
    return {group_id: 1.0 for group_id in owned}


def resolve_issue_agent_signal(
    actor: Any | None, organization: Organization, projects: Sequence[Project], group_ids: list[int]
) -> dict[int, float]:
    """Furthest Seer agent stage reached per group, normalized to [0, 1].

    A regression resets progress: stages reached before the group's latest
    SET_REGRESSION activity don't count, since that fix evidently didn't hold.
    """
    activities = Activity.objects.filter(
        group_id__in=group_ids,
        type__in=[*ISSUE_AGENT_STAGE_SIGNALS, ActivityType.SET_REGRESSION.value],
    ).values_list("group_id", "type", "datetime")
    last_regressed: dict[int, datetime] = {}
    seer_activities: list[tuple[int, int, datetime]] = []
    for group_id, activity_type, date in activities:
        if activity_type == ActivityType.SET_REGRESSION.value:
            if group_id not in last_regressed or date > last_regressed[group_id]:
                last_regressed[group_id] = date
        else:
            seer_activities.append((group_id, activity_type, date))
    signal: dict[int, float] = {}
    for group_id, activity_type, date in seer_activities:
        if group_id in last_regressed and date < last_regressed[group_id]:
            continue
        signal[group_id] = max(signal.get(group_id, 0.0), ISSUE_AGENT_STAGE_SIGNALS[activity_type])
    return signal


def recommended_v2_strategy() -> PostgresSortStrategy:
    """Recommended sort v2: the Snuba recommended score (recency/spike/severity/user
    impact/event volume) plus additive boosts for viewer relevance (assignment or suspect
    commit), Seer fixability, Seer agent progress, regressed issues, and newly-seen issues."""
    assignment_weight = options.get("snuba.search.recommended.assignment-weight")
    fixability_weight = options.get("snuba.search.recommended.fixability-weight")
    agent_weight = options.get("snuba.search.recommended.agent-weight")
    regressed_weight = options.get("snuba.search.recommended.regressed-weight")
    newness_weight = options.get("snuba.search.recommended.newness-weight")
    newness_halflife_hours = options.get("snuba.search.recommended.newness-halflife-hours")
    # Captured once per query so every group decays against the same clock.
    now = timezone.now()

    def score_fn(data: dict[str, Any]) -> float:
        # Personal relevance is a max, not a sum: a viewer who is both assignee and suspect
        # committer shouldn't be double-counted. Suspect-commit (0.8) sits just below direct
        # assignment (1.0) but above team assignment (0.5).
        relevance = max(
            data.get("assignment", 0.0),
            0.8 * data.get("suspect_commit", 0.0),
        )
        # Newness decays on first_seen (true first appearance), unlike the base recency
        # factor which decays on last_seen and can't tell a new issue from an old noisy one.
        first_seen = data.get("first_seen")
        newness = 0.0
        if first_seen is not None and newness_halflife_hours > 0:
            hours = max(0.0, (now - first_seen).total_seconds() / 3600)
            # Negative exponent so very old issues underflow to 0.0 rather than
            # overflowing the float (1.0 / 2.0**x blows up once x exceeds ~1024).
            newness = 2.0 ** -(hours / newness_halflife_hours)
        regressed = 1.0 if data.get("substatus") == GroupSubStatus.REGRESSED else 0.0
        return (
            (data.get("recommended") or 0.0)
            + assignment_weight * relevance
            + fixability_weight * (data.get("fixability") or 0.0)
            + agent_weight * data.get("agent", 0.0)
            + regressed_weight * regressed
            + newness_weight * newness
        )

    # A signal whose weight is zeroed via options can't affect the score, so don't
    # register its resolver and its query never runs. assignment_weight scales both
    # viewer-relevance signals.
    signal_resolvers: dict[
        str, Callable[[Any, Organization, Sequence[Project], list[int]], dict[int, Any]]
    ] = {}
    if assignment_weight:
        signal_resolvers["assignment"] = resolve_assignment_signal
        signal_resolvers["suspect_commit"] = resolve_suspect_commit_signal
    if agent_weight:
        signal_resolvers["agent"] = resolve_issue_agent_signal

    return PostgresSortStrategy(
        postgres_fields={
            "fixability": "seer_fixability_score",
            "substatus": "substatus",
            "first_seen": "first_seen",
        },
        snuba_aggregations=["recommended"],
        signal_resolvers=signal_resolvers,
        score_fn=score_fn,
        # If a boost calculation ever fails, keep the issue in the stream ranked by its
        # base Snuba recommended score rather than dropping it.
        fallback_score_fn=lambda data: data.get("recommended") or 0.0,
        # seer_fixability_score is null for most groups; score those as 0 rather
        # than excluding them.
        exclude_null_postgres=False,
    )


# Numeric rank for the "progress" sort: higher means further along the fix cycle, so it
# sorts towards the top. Every state has a rank so issues without seer activity (the
# identified/assigned base states) still order correctly relative to progressed issues.
PROGRESS_STATE_SORT_RANK: dict[IssueProgressState, int] = {
    IssueProgressState.IDENTIFIED: 1,
    IssueProgressState.ASSIGNED: 2,
    IssueProgressState.DIAGNOSED: 3,
    IssueProgressState.FIX_PROPOSED: 4,
    IssueProgressState.FIX_APPLIED: 5,
}

# last_seen comes back from Snuba as epoch milliseconds (< 1e13 until the year 2286), so
# dividing by this collapses it into a [0, 1) recency fraction. The score is then
# `rank + fraction`: rank stays the primary (integer) key and last_seen only breaks ties.
LAST_SEEN_TIEBREAK_DIVISOR = 10**13


def _get_group_progress_states_from_derived_data(group_ids: list[int]) -> dict[int, str]:
    """Read progress from the materialized GroupDerivedData.progress column, mirroring
    _get_derived_progress: the column stores the IssueProgressState value verbatim, a null
    column (closed issues) counts as fix_applied, and a group without a derived row counts
    as identified, so every group still gets a rank."""
    stored = dict(
        GroupDerivedData.objects.filter(group_id__in=group_ids).values_list("group_id", "progress")
    )
    result: dict[int, str] = {}
    for group_id in group_ids:
        if group_id not in stored:
            result[group_id] = IssueProgressState.IDENTIFIED.value
            continue
        progress = stored[group_id]
        if progress is None:
            result[group_id] = IssueProgressState.FIX_APPLIED.value
        else:
            result[group_id] = progress
    return result


def resolve_progress_signal(
    actor: Any | None, organization: Organization, projects: Sequence[Project], group_ids: list[int]
) -> dict[int, int]:
    """Progress-cycle rank per group (identified=1 .. fix_applied=5). When every project in
    scope has the ``projects:issue-stream-derived-progress`` flag enabled, progress is read
    from the materialized GroupDerivedData.progress column; otherwise it's derived from the
    same Activity records as the ``issue.progress`` filter. Every group gets a rank."""
    if _has_derived_progress(actor, projects):
        states = _get_group_progress_states_from_derived_data(group_ids)
    else:
        states = get_group_progress_states(group_ids)
    return {
        group_id: PROGRESS_STATE_SORT_RANK[IssueProgressState(state)]
        for group_id, state in states.items()
    }


def _resolve_last_progressed_at(
    actor: Any | None, organization: Organization, projects: Sequence[Project], group_ids: list[int]
) -> dict[int, float]:
    """Epoch-millisecond timestamp of the last progress change per group, read from
    GroupDerivedData.last_progressed_at. Groups without a value are omitted; score_fn
    falls through to last_seen for them."""
    if not _has_derived_progress(actor, projects):
        return {}
    rows = GroupDerivedData.objects.filter(
        group_id__in=group_ids, last_progressed_at__isnull=False
    ).values_list("group_id", "last_progressed_at")
    return {group_id: ts.timestamp() * 1000 for group_id, ts in rows if ts is not None}


def _has_derived_progress(actor: Any | None, projects: Sequence[Project]) -> bool:
    """Whether every project in scope reads progress from the materialized GroupDerivedData
    columns rather than the Activity derivation. The native ORDER BY and both signal resolvers
    gate on this: the SQL score only matches the in-memory score when the columns are the
    source of truth."""
    return bool(projects) and all(
        features.has("projects:issue-stream-derived-progress", project, actor=actor)
        for project in projects
    )


def _progress_native_order_by(queryset: BaseQuerySet) -> tuple[BaseQuerySet, str]:
    """SQL reproduction of progress_strategy().score_fn so the sort can ORDER BY it natively
    (no in-memory candidate cap). ``.extra`` (not ``.annotate``) lets the cursor Paginator
    reuse the alias SQL in its WHERE clause; the ``-id`` tiebreak gives equal scores a total
    order so paging can't drop/dup rows across a tie."""
    gdd = GroupDerivedData._meta.db_table
    identified = PROGRESS_STATE_SORT_RANK[IssueProgressState.IDENTIFIED]
    fix_applied = PROGRESS_STATE_SORT_RANK[IssueProgressState.FIX_APPLIED]

    when_states = ""
    params: list[Any] = [identified, fix_applied]
    for state, rank in PROGRESS_STATE_SORT_RANK.items():
        when_states += f" WHEN {gdd}.progress = %s THEN %s"
        params.extend([state.value, rank])
    params.append(identified)

    sql = (
        "((CASE"
        f" WHEN {gdd}.group_id IS NULL THEN %s"  # no derived row -> identified
        f" WHEN {gdd}.progress IS NULL THEN %s"  # null column (closed) -> fix_applied
        f"{when_states}"
        " ELSE %s"  # unknown string -> identified
        f" END) * {LAST_SEEN_TIEBREAK_DIVISOR}"
        " + CASE"
        f" WHEN {gdd}.last_progressed_at IS NOT NULL"
        f" THEN EXTRACT(EPOCH FROM {gdd}.last_progressed_at) * 1000"
        f" ELSE EXTRACT(EPOCH FROM {Group._meta.db_table}.last_seen) * 1000"
        " END)"
    )
    # F() on the nullable reverse OneToOne forces the LEFT OUTER JOIN the raw SQL relies on.
    queryset = (
        queryset.annotate(_gdd_join=F("groupderiveddata__progress"))
        .extra(select={"progress_sort_score": sql}, select_params=params)
        .order_by("-progress_sort_score", "-id")
    )
    return queryset, "-progress_sort_score"


def progress_strategy() -> PostgresSortStrategy:
    """
    Progress sort: primary by fix-cycle rank (fix_applied > fix_proposed > diagnosed >
    assigned > identified), secondary by last_progressed_at (falling back to last_seen
    when last_progressed_at is absent).
    """

    def score_fn(data: dict[str, Any]) -> float:
        rank = data.get("progress_rank") or 0
        last_progressed = data.get("last_progressed_at") or 0
        if last_progressed:
            # divisor used here as it happens to share units
            return rank + last_progressed / LAST_SEEN_TIEBREAK_DIVISOR

        last_seen = data.get("last_seen") or 0
        return rank + last_seen / LAST_SEEN_TIEBREAK_DIVISOR

    return PostgresSortStrategy(
        postgres_fields={},
        snuba_aggregations=["last_seen"],
        signal_resolvers={
            "progress_rank": resolve_progress_signal,
            "last_progressed_at": _resolve_last_progressed_at,
        },
        score_fn=score_fn,
        native_order_by=_progress_native_order_by,
    )


class PostgresSnubaQueryExecutor(AbstractQueryExecutor):
    ISSUE_FIELD_NAME = "group_id"

    logger = logging.getLogger("sentry.search.postgressnuba")
    dependency_aggregations = {
        "trends": ["last_seen", "times_seen"],
        "recommended": ["last_seen", "times_seen", "user_count"],
    }
    postgres_only_fields = {*SKIP_SNUBA_FIELDS, "regressed_in_release"}
    # add specific fields here on top of skip_snuba_fields from the serializer
    sort_strategies = {
        "date": "last_seen",
        "freq": "times_seen",
        "new": "first_seen",
        "trends": "trends",
        "recommended": "recommended",
        # Postgres-data sort; mapped to the recommended aggregation so the chunked
        # Snuba path can take over when there are too many candidates to score in memory.
        "recommended_v2": "recommended",
        "user": "user_count",
        # Postgres-data sort; mapped to last_seen so the chunked Snuba path can take over
        # (degrading to a plain last_seen sort) when there are too many candidates to score
        # the progress rank in memory.
        "progress": "last_seen",
        # We don't need a corresponding snuba field here, since this sort only happens
        # in Postgres
        "inbox": "",
    }

    aggregation_defs = {
        "times_seen": ["count()", ""],
        "first_seen": ["multiply(toUInt64(min(coalesce(group_first_seen, timestamp))), 1000)", ""],
        "last_seen": ["multiply(toUInt64(max(timestamp)), 1000)", ""],
        "trends": trends_aggregation,
        "recommended": recommended_aggregation,
        # Only makes sense with WITH TOTALS, returns 1 for an individual group.
        "total": ["uniq", ISSUE_FIELD_NAME],
        "user_count": ["uniq", "tags[sentry:user]"],
        "trends_issue_platform": trends_issue_platform_aggregation,
        "recommended_issue_platform": recommended_issue_platform_aggregation,
    }

    @property
    def dataset(self) -> Dataset:
        return Dataset.Events

    @property
    def postgres_sort_strategies(self) -> dict[str, PostgresSortStrategy]:
        return {
            "recommended_v2": recommended_v2_strategy(),
            "progress": progress_strategy(),
        }

    def _apply_type_visibility_filter(
        self,
        group_queryset: BaseQuerySet,
        search_filters: Sequence[SearchFilter] | None,
    ) -> BaseQuerySet:
        return group_queryset.filter(type__in=group_types_from(search_filters))

    def _execute_postgres_sort(
        self,
        strategy: PostgresSortStrategy,
        sort_by: str,
        group_queryset: BaseQuerySet,
        projects: Sequence[Project],
        environments: Sequence[Environment] | None,
        search_filters: Sequence[SearchFilter] | None,
        limit: int,
        cursor: Cursor | None,
        count_hits: bool,
        paginator_options: Mapping[str, Any],
        max_hits: int | None,
        actor: Any | None,
        start: datetime,
        end: datetime,
        native_upper_bound_ok: bool,
        aggregate_kwargs: TrendsSortWeights | None = None,
        *,
        referrer: str,
    ) -> CursorResult[Group] | None:
        """Execute a sort using Postgres data, with optional Snuba filtering/aggregation.

        Returns None to signal the caller should fall back to the Snuba-only path (e.g.
        when there are too many candidates to score in memory).
        """
        organization = projects[0].organization
        postgres_fields = strategy.postgres_fields

        group_queryset = self._apply_type_visibility_filter(group_queryset, search_filters)
        if strategy.exclude_null_postgres:
            for model_field in postgres_fields.values():
                group_queryset = group_queryset.filter(**{f"{model_field}__isnull": False})

        # Bound candidates by the lower edge of the search window using last_seen (the
        # group's max event timestamp). When Snuba runs it enforces the full event window.
        group_queryset = group_queryset.filter(last_seen__gte=start)

        non_snuba_fields = self.postgres_only_fields.union({"date", "timestamp"})
        has_snuba_filters = any(
            sf.key.name not in non_snuba_fields for sf in (search_filters or ())
        )

        # Cap-free path: when the strategy can order entirely in Postgres and the query has no
        # Snuba-side filters, ORDER BY the score natively instead of scoring candidates in
        # memory. Lifts the max-candidates cap for the common issue-stream case, past which the
        # in-memory path degrades to a plain last_seen sort.
        #
        # Skip when Snuba is needed for correctness: an environment scope (env-scoped values
        # live in Snuba) or a past upper bound (see native_upper_bound_ok).
        if (
            strategy.native_order_by is not None
            and not has_snuba_filters
            and not environments
            and native_upper_bound_ok
            and _has_derived_progress(actor, projects)
        ):
            with start_span(
                op="search.postgres_sort.native_order_by",
                name="search.postgres_sort.native_order_by",
            ):
                ordered_queryset, order_by = strategy.native_order_by(group_queryset)
                return Paginator(
                    ordered_queryset.using_replica(), order_by=order_by, **paginator_options
                ).get_result(limit, cursor, count_hits=count_hits, max_hits=max_hits)

        max_candidates = options.get("snuba.search.max-pre-snuba-candidates")
        with start_span(
            op="search.postgres_sort.candidates", name="search.postgres_sort.candidates"
        ) as span:
            candidate_ids = list(
                group_queryset.using_replica().values_list("id", flat=True)[: max_candidates + 1]
            )
            set_span_data(span, "candidate_count", len(candidate_ids))

        if not candidate_ids:
            return self.empty_result

        if len(candidate_ids) > max_candidates:
            # Too many candidates to score in memory. If the strategy can order natively in
            # Postgres, invert the Snuba chunked loop: walk GroupDerivedData in score order
            # (Postgres is the sort authority) and use Snuba only as a membership filter per
            # chunk. This keeps the correct ranking past the cap even with Snuba-side filters
            # / env scoping / an upper time bound, instead of degrading to a last_seen sort.
            if strategy.native_order_by is not None and _has_derived_progress(actor, projects):
                return self._execute_inverted_chunk_sort(
                    strategy=strategy,
                    group_queryset=group_queryset,
                    projects=projects,
                    environments=environments,
                    search_filters=search_filters,
                    sort_by=sort_by,
                    limit=limit,
                    cursor=cursor,
                    count_hits=count_hits,
                    paginator_options=paginator_options,
                    max_hits=max_hits,
                    actor=actor,
                    start=start,
                    end=end,
                    referrer=referrer,
                )
            # Otherwise signal the caller to fall through to the Snuba chunked path, which
            # can paginate without an in-memory bound.
            return None

        # Hit Snuba when the strategy needs an aggregation value or the query has
        # event-level filters. The aggregation is passed as the Snuba sort field so its
        # per-group value comes back as the score; with no aggregation we sort by last_seen
        # (ignored by score_fn) and just use the result to narrow candidates to those
        # matching the filters. One aggregation is supported.
        snuba_data: dict[int, dict[str, Any]] = {}
        if strategy.snuba_aggregations or has_snuba_filters:
            sort_field = (
                strategy.snuba_aggregations[0] if strategy.snuba_aggregations else "last_seen"
            )
            # sort_field is used directly as a key into aggregation_defs downstream; a
            # misconfigured strategy should fail loudly here rather than with an opaque
            # KeyError deep in query construction.
            if sort_field not in self.aggregation_defs:
                raise InvalidQueryForExecutor(
                    f"Unknown snuba aggregation {sort_field!r} in Postgres sort strategy"
                )
            with start_span(
                op="search.postgres_sort.snuba_aggregation",
                name="search.postgres_sort.snuba_aggregation",
            ):
                snuba_groups, _ = self.snuba_search(
                    start=start,
                    end=end,
                    project_ids=[p.id for p in projects],
                    environment_ids=[env.id for env in environments] if environments else None,
                    organization=organization,
                    sort_field=sort_field,
                    cursor=None,
                    group_ids=candidate_ids,
                    limit=len(candidate_ids),
                    offset=0,
                    search_filters=search_filters,
                    referrer=referrer,
                    actor=actor,
                    aggregate_kwargs=aggregate_kwargs,
                )
            snuba_data = {gid: {sort_field: score} for gid, score in snuba_groups}
            candidate_ids = list(snuba_data.keys())

        if not candidate_ids:
            return self.empty_result

        logical_names = list(postgres_fields.keys())
        with start_span(
            op="search.postgres_sort.postgres_fields", name="search.postgres_sort.postgres_fields"
        ):
            pg_rows = (
                group_queryset.filter(id__in=candidate_ids)
                .using_replica()
                .values_list("id", *postgres_fields.values())
            )
            pg_data = {row[0]: dict(zip(logical_names, row[1:])) for row in pg_rows}

        # Each signal resolver runs once over all candidates, returning {group_id: value}.
        # Span each separately so an expensive resolver (e.g. the agent-progress Activity
        # scan) is visible on its own rather than buried in an aggregate.
        signal_data: dict[str, dict[int, Any]] = {}
        for name, resolver in strategy.signal_resolvers.items():
            with start_span(
                op=f"search.postgres_sort.signal.{name}", name=f"search.postgres_sort.signal.{name}"
            ):
                signal_data[name] = resolver(actor, organization, projects, candidate_ids)

        with start_span(op="search.postgres_sort.scoring", name="search.postgres_sort.scoring"):
            scored_groups: list[tuple[Any, int]] = []
            for gid in candidate_ids:
                pg_values = pg_data.get(gid)
                if pg_values is None:
                    continue
                merged = {
                    **pg_values,
                    **snuba_data.get(gid, {}),
                    **{name: values[gid] for name, values in signal_data.items() if gid in values},
                }
                try:
                    score = strategy.score_fn(merged)
                except (TypeError, KeyError, ArithmeticError) as e:
                    # A single malformed/extreme row must never 500 the whole issue stream
                    # (ArithmeticError covers overflow/underflow/zero-division in score
                    # math). Rather than drop the issue -- which removes it from the view
                    # entirely -- fall back to the strategy's base score so it still shows,
                    # just without the boosts. Logged so a recurring bug stays discoverable.
                    self.logger.warning(
                        "postgres_sort.score_fn_failed",
                        extra={
                            "sort_by": sort_by,
                            "group_id": gid,
                            "error": str(e),
                            "error_type": type(e).__name__,
                        },
                    )
                    try:
                        score = strategy.fallback_score_fn(merged)
                    except (TypeError, KeyError, ArithmeticError):
                        continue
                scored_groups.append((score, gid))

        if not scored_groups:
            return self.empty_result

        paginator_results = SequencePaginator(
            scored_groups, reverse=True, **paginator_options
        ).get_result(limit, cursor, count_hits=count_hits, max_hits=max_hits)

        groups = Group.objects.in_bulk(paginator_results.results)
        paginator_results.results = [groups[k] for k in paginator_results.results if k in groups]
        return paginator_results

    def _execute_inverted_chunk_sort(
        self,
        *,
        strategy: PostgresSortStrategy,
        group_queryset: BaseQuerySet,
        projects: Sequence[Project],
        environments: Sequence[Environment] | None,
        search_filters: Sequence[SearchFilter] | None,
        sort_by: str,
        limit: int,
        cursor: Cursor | None,
        count_hits: bool,
        paginator_options: Mapping[str, Any],
        max_hits: int | None,
        actor: Any | None,
        start: datetime,
        end: datetime,
        referrer: str,
    ) -> CursorResult[Group]:
        """Over-cap progress sort with a Snuba-side filter (and/or environment scoping and/or
        an explicit upper time bound).

        Inverts the standard chunked path: Postgres/GroupDerivedData is the SORT authority --
        we ORDER BY the native progress score and walk it in score order -- and Snuba is only
        a membership FILTER. Each Postgres-ordered chunk of group_ids is sent to snuba_search;
        we keep the ids it returns, preserving Postgres order. This avoids the in-memory
        candidate cap without degrading to a recency sort.

        The cursor is a scaled-int progress score, so it is applied in Postgres only; every
        snuba_search call passes cursor=None (a cursor there becomes a HAVING on last_seen,
        which our value is not).
        """
        assert strategy.native_order_by is not None
        organization = projects[0].organization
        if cursor is None:
            cursor = Cursor(0, 0, False)
        is_prev = cursor.is_prev

        # Postgres is the sort authority: order the whole candidate set by the native score
        # and walk it. Snuba only decides membership below.
        ordered_queryset, order_by = strategy.native_order_by(group_queryset)
        ordered_queryset = ordered_queryset.using_replica()
        # order_by is the signed key (e.g. "-progress_sort_score"); the alias it references is
        # the same name without the direction prefix.
        sort_key = order_by.lstrip("-")

        # Bound the walk by the cursor in Postgres, reusing the .extra() alias SQL exactly as
        # BasePaginator.build_queryset does. FLOOR() is required: the score's tiebreak term
        # (EXTRACT(EPOCH ...) * 1000) is fractional, but the cursor value is the floored int
        # that SequencePaginator emits, so a raw "<= value" would drop the boundary-tie row.
        col_sql, col_params = ordered_queryset.query.extra[sort_key]
        walk_queryset: Any = ordered_queryset
        if is_prev:
            walk_queryset = walk_queryset.order_by(sort_key, "id")
        if cursor.value:
            operator = ">=" if is_prev else "<="
            walk_queryset = walk_queryset.extra(
                where=[f"FLOOR({col_sql}) {operator} %s"],
                params=list(col_params) + [cursor.value],
            )
        walk_queryset = walk_queryset.values_list("id", sort_key)

        # Progress reorders but does not change membership, so total hits equal the recency
        # query's; estimate them exactly as the too_many_candidates path does.
        hits = self.calculate_hits(
            [],
            True,
            "last_seen",
            projects,
            None,
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
            referrer=referrer,
        )

        chunk_growth = options.get("snuba.search.chunk-growth-rate")
        max_chunk_size = options.get("snuba.search.max-chunk-size")
        max_time = options.get("snuba.search.max-total-chunk-time-seconds")

        # Accumulate enough passers for the page plus one lookahead row, then fully drain the
        # boundary score-tie so SequencePaginator sees a complete, contiguous prefix (the walk
        # visits a floor-tie block contiguously, so crossing the block collects all of it).
        need = cursor.offset + limit + 1
        passers: list[tuple[int, int]] = []
        boundary_score: int | None = None
        walk_exhausted = False
        budget_exhausted = False

        project_ids = [p.id for p in projects]
        environment_ids = [e.id for e in environments] if environments else None
        pg_offset = 0
        chunk_size = limit
        num_chunks = 0

        time_start = time.time()
        with start_span(
            op="search.postgres_sort.inverted_chunk",
            name="search.postgres_sort.inverted_chunk",
        ) as span:
            while True:
                if (time.time() - time_start) >= max_time:
                    budget_exhausted = True
                    break

                chunk_size = min(int(chunk_size * chunk_growth), max_chunk_size)
                num_chunks += 1

                rows = list(walk_queryset[pg_offset : pg_offset + chunk_size])
                if not rows:
                    walk_exhausted = True
                    break
                pg_offset += len(rows)

                chunk_ids = [row[0] for row in rows]
                # cursor=None: the cursor is a progress score, applied in Postgres above;
                # here Snuba is a pure membership filter over this chunk's group_ids.
                snuba_groups, _ = self.snuba_search(
                    start=start,
                    end=end,
                    project_ids=project_ids,
                    environment_ids=environment_ids,
                    organization=organization,
                    sort_field="last_seen",
                    cursor=None,
                    group_ids=chunk_ids,
                    limit=len(chunk_ids),
                    offset=0,
                    search_filters=search_filters,
                    referrer=referrer,
                    actor=actor,
                )
                passing_ids = {gid for gid, _ in snuba_groups}
                for gid, raw_score in rows:
                    if gid in passing_ids:
                        passers.append((int(floor(raw_score)), gid))

                # A short chunk means the (cursor-bounded) walk is exhausted.
                if len(rows) < chunk_size:
                    walk_exhausted = True
                    break

                if boundary_score is None and len(passers) >= need:
                    boundary_score = passers[need - 1][0]
                if boundary_score is not None:
                    last_floor = int(floor(rows[-1][1]))
                    crossed = (
                        last_floor > boundary_score if is_prev else last_floor < boundary_score
                    )
                    if crossed:
                        break

            set_span_data(span, "num_chunks", num_chunks)
            set_span_data(span, "num_passers", len(passers))
        metrics.distribution("search.progress_inverted.num_chunks", num_chunks)

        if not passers:
            # No Snuba matches in the rows we walked. When the walk is exhausted this is
            # genuinely empty. When we stopped early on the time budget, later rows could still
            # match -- but our cursor value is a progress score and cannot encode a mid-tie
            # "resume at raw row N" checkpoint (the score is not unique, and the paginator
            # offset is defined over passers, not raw scanned rows). Advertising next without an
            # advancing cursor value (0:0:0) would make the client rescan the same prefix
            # forever, so we return a terminating empty page instead -- matching the
            # non-inverted chunked loop's behavior on budget exhaustion. This can under-report
            # on a highly selective filter over a huge high-progress prefix; the metric tracks
            # how often we hit it so the Snuba-native path can be prioritized if it is material.
            if budget_exhausted:
                metrics.incr("search.progress_inverted_budget_exhausted", skip_internal=False)
                sentry_sdk.set_tag("search.progress_inverted_budget_exhausted", "true")
            return self.empty_result

        # SequencePaginator re-sorts by (int_score, group_id) DESC, so accumulation order is
        # irrelevant; only the set of passers matters.
        paginator_results = SequencePaginator(
            passers, reverse=True, **paginator_options
        ).get_result(limit, cursor, known_hits=hits, max_hits=max_hits)

        # HACK (mirrors the Snuba chunk loop): we are 'lying' to the SequencePaginator -- it
        # treats `passers` as the whole result set, but if we stopped before exhausting the
        # Postgres walk there may be more matches it can't see. When the walk is exhausted its
        # has_results in the walk direction is exact, so we trust it.
        if is_prev:
            paginator_results.next.has_results = True
            if not walk_exhausted:
                paginator_results.prev.has_results = True
        else:
            if not walk_exhausted:
                paginator_results.next.has_results = True
            if cursor.value or cursor.offset:
                paginator_results.prev.has_results = True

        if budget_exhausted:
            # Never degrade to recency: return the partial, correctly-ordered page and let the
            # user page forward for the remainder. has_results in the walk direction is already
            # forced True above (budget exhaustion implies the walk was not exhausted).
            metrics.incr("search.progress_inverted_budget_exhausted", skip_internal=False)
            sentry_sdk.set_tag("search.progress_inverted_budget_exhausted", "true")

        groups = Group.objects.in_bulk(paginator_results.results)
        paginator_results.results = [groups[k] for k in paginator_results.results if k in groups]
        return paginator_results

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
        actor: Any | None = None,
        aggregate_kwargs: TrendsSortWeights | None = None,
        *,
        referrer: str,
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

        # The native path bounds only by Group.last_seen (a global max, never in the future),
        # so it's correct for any upper bound at/after now. The endpoint always sends
        # date_to=now, so gate on "not in the past" (within clock fuzz), not "no bound at all".
        # (A caller pinning an absolute end near now could flip this across pages as now
        # advances; the default stream recomputes end=now each request, so it stays stable.)
        native_upper_bound_ok = end is None or end >= now - ALLOWED_FUTURE_DELTA

        allow_postgres_only_search = False
        if not end:
            end = now + ALLOWED_FUTURE_DELTA
            allow_postgres_only_search = True

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

        pg_overflow_fallback = False
        pg_strategy = self.postgres_sort_strategies.get(sort_by)
        if pg_strategy is not None:
            pg_result = self._execute_postgres_sort(
                strategy=pg_strategy,
                sort_by=sort_by,
                group_queryset=group_queryset,
                projects=projects,
                environments=environments,
                search_filters=search_filters,
                limit=limit,
                cursor=cursor,
                count_hits=count_hits,
                paginator_options=paginator_options,
                max_hits=max_hits,
                actor=actor,
                start=start,
                end=end,
                native_upper_bound_ok=native_upper_bound_ok,
                aggregate_kwargs=aggregate_kwargs,
                referrer=referrer,
            )
            if pg_result is not None:
                metrics.timing(
                    "snuba.search.query",
                    (timezone.now() - now).total_seconds(),
                    tags={"postgres_only": False, "sort": sort_by},
                )
                return pg_result
            # Overflow: too many candidates to score in memory. Fall through to the Snuba
            # chunked path (which applies issue-type visibility), never the postgres-only
            # `date` shortcut below. If this sort has no Snuba-only equivalent, fall back
            # to `date`.
            pg_overflow_fallback = True
            # Surface the silent ranking degradation on the trace, next to `search.sort`.
            sentry_sdk.set_tag("search.sort_fallback", sort_by)
            sentry_sdk.set_attribute("search.sort_fallback", sort_by)
            # Keep the original sort only if it maps to a real Snuba aggregation for the
            # chunked path. Keys absent from sort_strategies, or mapped to "" (Postgres-only
            # sorts like "inbox"), have no aggregation and must fall back to `date` instead
            # of flowing an empty sort_field into the aggregation lookup.
            if not self.sort_strategies.get(sort_by):
                sort_by = "date"

        # If the requested sort is `date` (`last_seen`) and there
        # are no other Snuba-based search predicates, we can simply
        # return the results from Postgres.
        if (
            # XXX: Don't enable this for now, it doesn't properly respect issue platform rules for hiding issue types.
            # We'll need to consolidate where we apply the type filters if we do want this.
            allow_postgres_only_search
            and not pg_overflow_fallback
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

        with start_span(op="snuba_group_query", name="snuba_group_query") as span:
            group_ids = list(
                group_queryset.using_replica().values_list("id", flat=True)[: max_candidates + 1]
            )
            set_span_data(span, "Max Candidates", max_candidates)
            set_span_data(span, "Result Size", len(group_ids))
        metrics.distribution("snuba.search.num_candidates", len(group_ids))
        too_many_candidates = False
        original_group_ids: list[int] | None = None
        if not group_ids:
            # no matches could possibly be found from this point on
            metrics.incr("snuba.search.no_candidates", skip_internal=False)
            return self.empty_result
        elif len(group_ids) > max_candidates:
            original_group_ids = group_ids

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
            referrer=referrer,
        )
        if count_hits and hits == 0:
            # Sampling estimated 0 hits. This could mean:
            # 1. There are genuinely no results (return empty)
            # 2. The filter is selective and sampling failed to find matches
            #
            # If we had too_many_candidates, fall back to truncation instead of
            # returning empty. This handles selective filters (like assigned_to)
            # where random sampling is unlikely to find matches.
            if too_many_candidates and original_group_ids:
                metrics.incr("snuba.search.hits_zero_fallback_to_truncation", skip_internal=False)
                group_ids = original_group_ids[:max_candidates]
                too_many_candidates = False
                hits = None
            else:
                return self.empty_result

        paginator_results = self.empty_result
        result_groups: list[tuple[int, Any]] = []
        result_group_ids: set[int] = set()

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
                environment_ids=[environment.id for environment in environments]
                if environments
                else None,
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
                filtered_count = 0
                for group_id in filtered_group_ids:
                    filtered_count += 1
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
        *,
        referrer: str,
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

            snuba_groups, snuba_total = self.snuba_search(
                start=start,
                end=end,
                project_ids=[p.id for p in projects],
                environment_ids=[environment.id for environment in environments]
                if environments
                else None,
                organization=projects[0].organization,
                sort_field=sort_field,
                group_ids=group_ids if not too_many_candidates else None,
                limit=sample_size,
                offset=0,
                get_sample=True,
                search_filters=search_filters,
                actor=actor,
                referrer=referrer,
            )
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
