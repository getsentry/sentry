from __future__ import annotations

import functools
import logging
from collections.abc import Callable, Mapping, Sequence
from copy import deepcopy
from typing import Any, Optional, Protocol, TypedDict

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.issues import grouptype
from sentry.issues.grouptype import (
    GroupCategory,
    GroupType,
    get_all_group_type_ids,
    get_group_type_by_type_id,
)
from sentry.issues.grouptype import registry as GT_REGISTRY
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.search.events.filter import convert_search_filter_to_snuba_query
from sentry.snuba.dataset import Dataset
from sentry.utils import snuba
from sentry.utils.snuba import SnubaQueryParams


class UnsupportedSearchQuery(Exception):
    pass


class IntermediateSearchQueryPartial(Protocol):
    def __call__(
        self,
        groupby: Sequence[str],
        having: Sequence[Any],
        orderby: Sequence[str],
    ) -> Mapping[str, Any]: ...


class SearchQueryPartial(Protocol):
    def __call__(
        self,
        dataset: Dataset,
        selected_columns: Sequence[Any],
        filter_keys: Mapping[str, Sequence[int]],
        conditions: Sequence[Any],
        aggregations: Sequence[Any],
        condition_resolver: Any,
    ) -> Mapping[str, Any]: ...


GroupSearchFilterUpdater = Callable[[Sequence[SearchFilter]], Sequence[SearchFilter]]

GroupSearchStrategy = Callable[
    [
        SearchQueryPartial,
        Sequence[Any],
        Sequence[Any],
        int,
        Sequence[int],
        Optional[Sequence[Environment]],
        Optional[Sequence[int]],
        Mapping[str, Sequence[int]],
        Sequence[Any],
        Optional[Any],
    ],
    Optional[SnubaQueryParams],
]


class MergeableRow(TypedDict, total=False):
    group_id: int


def group_categories_from(
    search_filters: Sequence[SearchFilter] | None,
) -> set[int]:
    """Iterates over search_filters for any Group-specific filters

    :returns: a set of GroupCategories if the list of search-filters targets a Group type or category, else
                an empty set.
    """
    group_categories: set[int] = set()
    # determine which dataset to fan-out to based on the search filter criteria provided
    # if its unspecified, we have to query all datasources
    for search_filter in search_filters or ():
        if search_filter.key.name in ("issue.category", "issue.type"):
            if search_filter.is_negation:
                # get all group categories except the ones in the negation filter
                group_categories.update(
                    get_group_type_by_type_id(value).category
                    for value in get_all_group_type_ids()
                    if value not in search_filter.value.raw_value
                )
            else:
                group_categories.update(
                    get_group_type_by_type_id(value).category
                    for value in search_filter.value.raw_value
                )

    return group_categories


def group_types_from(
    search_filters: Sequence[SearchFilter] | None,
) -> set[int]:
    """
    Return the set of group type ids to include in the query, or None if all group types should be included.
    """

    # if no relevant filters, return none to signify we should query all group types
    if not any(sf.key.name in ("issue.category", "issue.type") for sf in search_filters or ()):
        # Filters some types from the default search
        all_group_type_objs: list[GroupType] = [
            GT_REGISTRY.get_by_type_id(id) for id in GT_REGISTRY.get_all_group_type_ids()
        ]
        return {gt.type_id for gt in all_group_type_objs if gt.in_default_search}

    # start by including all group types
    include_group_types = set(get_all_group_type_ids())
    for search_filter in search_filters or ():
        # note that for issue.category, the raw value becomes the full list of group type ids mapped from the category
        if search_filter.key.name in ("issue.category", "issue.type"):
            if search_filter.is_negation:
                include_group_types -= set(search_filter.value.raw_value)
            else:
                include_group_types &= set(search_filter.value.raw_value)
    return include_group_types


def _query_params_for_error(
    query_partial: SearchQueryPartial,
    selected_columns: Sequence[Any],
    aggregations: Sequence[Any],
    organization_id: int,
    project_ids: Sequence[int],
    environments: Sequence[Environment] | None,
    group_ids: Sequence[int] | None,
    filters: Mapping[str, Sequence[int]],
    conditions: Sequence[Any],
    actor: Any | None = None,
) -> SnubaQueryParams | None:
    if group_ids:
        filters = {"group_id": sorted(group_ids), **filters}
    error_conditions = _updated_conditions(
        "event.type",
        "!=",
        "transaction",
        organization_id,
        project_ids,
        environments,
        conditions,
    )

    params = query_partial(
        dataset=Dataset.Discover,
        selected_columns=selected_columns,
        filter_keys=filters,
        conditions=error_conditions,
        aggregations=aggregations,
        condition_resolver=snuba.get_snuba_column_name,
    )

    return SnubaQueryParams(**params)


def _query_params_for_generic(
    query_partial: SearchQueryPartial,
    selected_columns: Sequence[Any],
    aggregations: Sequence[Any],
    organization_id: int,
    project_ids: Sequence[int],
    environments: Sequence[Environment] | None,
    group_ids: Sequence[int] | None,
    filters: Mapping[str, Sequence[int]],
    conditions: Sequence[Any],
    actor: Any | None = None,
    categories: Sequence[GroupCategory] | None = None,
) -> SnubaQueryParams | None:
    organization = Organization.objects.filter(id=organization_id).first()
    if organization:
        if categories is None:
            logging.error("Category is required in _query_params_for_generic")
            return None

        category_ids = {gc.value for gc in categories}
        group_types = {
            gt.type_id
            for gt in grouptype.registry.get_visible(organization, actor)
            if gt.category in category_ids
        }
        if not group_types:
            return None

        filters = {"occurrence_type_id": list(group_types), **filters}
        if group_ids:
            filters["group_id"] = sorted(group_ids)

        params = query_partial(
            dataset=Dataset.IssuePlatform,
            selected_columns=selected_columns,
            filter_keys=filters,
            conditions=conditions,
            aggregations=aggregations,
            condition_resolver=functools.partial(
                snuba.get_snuba_column_name, dataset=Dataset.IssuePlatform
            ),
        )

        return SnubaQueryParams(**params)
    return None


def get_search_strategies() -> Mapping[int, GroupSearchStrategy]:
    strategies = {}
    for group_category in GroupCategory:
        if group_category == GroupCategory.ERROR:
            strategy = _query_params_for_error
        else:
            strategy = functools.partial(_query_params_for_generic, categories=[group_category])
        strategies[group_category.value] = strategy
    return strategies


def _update_profiling_search_filters(
    search_filters: Sequence[SearchFilter],
) -> Sequence[SearchFilter]:
    updated_filters = []

    for sf in search_filters:
        # XXX: we replace queries on these keys to something that should return nothing since
        # profiling issues doesn't support stacktraces
        if sf.key.name in ("error.unhandled", "error.handled", "error.main_thread"):
            raise UnsupportedSearchQuery(
                f"{sf.key.name} filter isn't supported for {GroupCategory.PROFILE.name}"
            )
        else:
            updated_filters.append(sf)

    return updated_filters


SEARCH_FILTER_UPDATERS: Mapping[int, GroupSearchFilterUpdater] = {
    GroupCategory.PERFORMANCE.value: lambda search_filters: [
        # need to remove this search filter, so we don't constrain the returned transactions
        sf
        for sf in _update_profiling_search_filters(search_filters)
        if sf.key.name != "message"
    ],
    GroupCategory.PROFILE.value: _update_profiling_search_filters,
}


def _updated_conditions(
    key: str,
    operator: str,
    value: str,
    organization_id: int,
    project_ids: Sequence[int],
    environments: Sequence[Environment] | None,
    conditions: Sequence[Any],
) -> Sequence[Any]:
    search_filter = SearchFilter(
        key=SearchKey(name=key),
        operator=operator,
        value=SearchValue(raw_value=value),
    )
    converted_filter = convert_search_filter_to_snuba_query(
        search_filter,
        params={
            "organization_id": organization_id,
            "project_id": project_ids,
            "environment": environments,
        },
    )
    new_conditions = deepcopy(list(conditions))
    new_conditions.append(converted_filter)
    return new_conditions
