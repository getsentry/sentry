from __future__ import annotations

import functools
from copy import deepcopy
from typing import Any, Callable, Mapping, Optional, Protocol, Sequence, Set, TypedDict

from sentry import features
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.models import Environment, Organization
from sentry.search.events.filter import convert_search_filter_to_snuba_query
from sentry.types.issues import GROUP_TYPE_TO_CATEGORY, GroupCategory, GroupType
from sentry.utils import snuba
from sentry.utils.snuba import SnubaQueryParams

ALL_ISSUE_TYPES = {gt.value for gt in GroupType}


class IntermediateSearchQueryPartial(Protocol):
    def __call__(
        self,
        selected_columns: Sequence[str],
        groupby: Sequence[str],
        having: Sequence[Any],
        orderby: Sequence[str],
    ) -> Mapping[str, Any]:
        ...


class SearchQueryPartial(Protocol):
    def __call__(
        self,
        dataset: snuba.Dataset,
        conditions: Sequence[Any],
        aggregations: Sequence[Any],
        condition_resolver: Any,
    ) -> Mapping[str, Any]:
        ...


GroupSearchFilterUpdater = Callable[[Sequence[SearchFilter]], Sequence[SearchFilter]]

GroupSearchStrategy = Callable[
    [
        SearchQueryPartial,
        Sequence[Any],
        int,
        Sequence[int],
        Optional[Sequence[Environment]],
        Sequence[Any],
    ],
    Optional[SnubaQueryParams],
]


class MergeableRow(TypedDict, total=False):
    group_id: int


def group_categories_from(
    search_filters: Optional[Sequence[SearchFilter]],
) -> Set[GroupCategory]:
    """Iterates over search_filters for any Group-specific filters

    :returns: a set of GroupCategories if the list of search-filters targets a Group type or category, else
                an empty set.
    """
    group_categories: Set[GroupCategory] = set()
    # determine which dataset to fan-out to based on the search filter criteria provided
    # if its unspecified, we have to query all datasources
    for search_filter in search_filters or ():
        if search_filter.key.name in ("issue.category", "issue.type"):
            if search_filter.is_negation:
                group_categories.update(
                    GROUP_TYPE_TO_CATEGORY[GroupType(value)]
                    for value in list(
                        filter(
                            lambda x: x not in ALL_ISSUE_TYPES,
                            search_filter.value.raw_value,
                        )
                    )
                )
            else:
                group_categories.update(
                    GROUP_TYPE_TO_CATEGORY[GroupType(value)]
                    for value in search_filter.value.raw_value
                )

    return group_categories


def _query_params_for_error(
    query_partial: SearchQueryPartial,
    aggregations: Sequence[Any],
    organization_id: int,
    project_ids: Sequence[int],
    environments: Optional[Sequence[Environment]],
    conditions: Sequence[Any],
) -> Optional[SnubaQueryParams]:
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
        dataset=snuba.Dataset.Discover,
        conditions=error_conditions,
        aggregations=aggregations,
        condition_resolver=snuba.get_snuba_column_name,
    )

    return SnubaQueryParams(**params)


def _query_params_for_perf(
    query_partial: SearchQueryPartial,
    aggregations: Sequence[Any],
    organization_id: int,
    project_ids: Sequence[int],
    environments: Optional[Sequence[Environment]],
    conditions: Sequence[Any],
) -> Optional[SnubaQueryParams]:
    organization = Organization.objects.filter(id=organization_id).first()
    if organization and features.has("organizations:performance-issues", organization):
        transaction_conditions = _updated_conditions(
            "event.type",
            "=",
            "transaction",
            organization_id,
            project_ids,
            environments,
            conditions,
        )

        mod_agg = list(aggregations).copy() if aggregations else []
        mod_agg.insert(0, ["arrayJoin", ["group_ids"], "group_id"])

        params = query_partial(
            dataset=snuba.Dataset.Discover,
            conditions=transaction_conditions,
            aggregations=mod_agg,
            condition_resolver=functools.partial(
                snuba.get_snuba_column_name, dataset=snuba.Dataset.Transactions
            ),
        )

        return SnubaQueryParams(**params)
    return None


SEARCH_STRATEGIES: Mapping[GroupCategory, GroupSearchStrategy] = {
    GroupCategory.ERROR: _query_params_for_error,
    GroupCategory.PERFORMANCE: _query_params_for_perf,
}


SEARCH_FILTER_UPDATERS: Mapping[GroupCategory, GroupSearchFilterUpdater] = {
    GroupCategory.ERROR: lambda search_filters: search_filters,
    GroupCategory.PERFORMANCE: lambda search_filters: [
        # need to remove this search filter, so we don't constrain the returned transactions
        sf
        for sf in search_filters
        if sf.key.name != "message"
    ],
}


def _updated_conditions(
    key: str,
    operator: str,
    value: str,
    organization_id: int,
    project_ids: Sequence[int],
    environments: Optional[Sequence[Environment]],
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
