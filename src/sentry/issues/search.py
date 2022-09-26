from __future__ import annotations

import functools
from copy import deepcopy
from typing import Any, Callable, Iterable, Mapping, Optional, Protocol, Sequence, Set, TypedDict

from sentry import features
from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.models import Environment, Organization
from sentry.search.events.filter import convert_search_filter_to_snuba_query
from sentry.types.issues import GroupCategory
from sentry.utils import snuba
from sentry.utils.snuba import SnubaQueryParams, raw_query_params


class SearchQueryPartial(Protocol):
    def __call__(
        self, conditions: Sequence[Any], aggregations: Sequence[Any], condition_resolver: Any
    ) -> Mapping[str, Any]:
        ...


GroupSearchStrategy = Callable[
    [
        Set[GroupCategory],
        Sequence[Any],
        SearchQueryPartial,
        int,
        Sequence[int],
        Optional[Sequence[Environment]],
        Sequence[Any],
    ],
    Optional[SnubaQueryParams],
]


class MergeableRow(TypedDict, total=False):
    group_id: int


class GroupSearchParamsMapper:
    """
    Based on the search query used, we may need to 'split', map, and query multiple sources to satisfy the search.
    This class maps the GroupCategories being searched to the appropriate function(s) to be used for generating the
    parameters to then be used for bulk-querying snuba in parallel.
    """

    @staticmethod
    def search_strategies_for(
        group_categories: Iterable[GroupCategory],
    ) -> Sequence[GroupSearchStrategy]:
        return (
            list(GroupSearchParamsMapper.search_strategies().values())
            if not group_categories
            else [GroupSearchParamsMapper.search_strategies()[gc] for gc in group_categories]
        )

    @staticmethod
    def search_strategies() -> Mapping[GroupCategory, GroupSearchStrategy]:
        return {
            GroupCategory.ERROR: GroupSearchParamsMapper._query_params_for_error,
            GroupCategory.PERFORMANCE: GroupSearchParamsMapper._query_params_for_perf,
        }

    @staticmethod
    def updated_conditions(
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

    @staticmethod
    def _query_params_for_error(
        group_categories: Set[GroupCategory],
        aggregations: Sequence[Any],
        query_partial: SearchQueryPartial,
        organization_id: int,
        project_ids: Sequence[int],
        environments: Optional[Sequence[Environment]],
        conditions: Sequence[Any],
    ) -> Optional[SnubaQueryParams]:
        if not group_categories or GroupCategory.ERROR in group_categories:
            error_conditions = GroupSearchParamsMapper.updated_conditions(
                "event.type",
                "!=",
                "transaction",
                organization_id,
                project_ids,
                environments,
                conditions,
            )

            params = query_partial(
                conditions=error_conditions,
                aggregations=aggregations,
                condition_resolver=snuba.get_snuba_column_name,
            )

            return raw_query_params(**params)
        return None

    @staticmethod
    def _query_params_for_perf(
        group_categories: Set[GroupCategory],
        aggregations: Sequence[Any],
        query_partial: SearchQueryPartial,
        organization_id: int,
        project_ids: Sequence[int],
        environments: Optional[Sequence[Environment]],
        conditions: Sequence[Any],
    ) -> Optional[SnubaQueryParams]:
        organization = Organization.objects.filter(id=organization_id).first()
        if (
            organization
            and features.has("organizations:performance-issues", organization)
            and (not group_categories or GroupCategory.PERFORMANCE in group_categories)
        ):
            transaction_conditions = GroupSearchParamsMapper.updated_conditions(
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
                conditions=transaction_conditions,
                aggregations=mod_agg,
                condition_resolver=functools.partial(
                    snuba.get_snuba_column_name, dataset=snuba.Dataset.Transactions
                ),
            )

            return raw_query_params(**params)
        return None
