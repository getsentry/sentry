from typing import Any, List, Optional, Sequence

from snuba_sdk.conditions import Condition, Op

from sentry.search.events.builder import QueryBuilder
from sentry.search.events.fields import InvalidSearchQuery
from sentry.search.events.types import ParamsType, WhereType
from sentry.utils.snuba import Dataset


def query(
    selected_columns: Sequence[str],
    query: Optional[str],
    params: ParamsType,
    equations: Optional[Sequence[str]] = None,
    orderby: Optional[Sequence[str]] = None,
    offset: int = 0,
    limit: int = 50,
    referrer: Optional[str] = None,
    auto_fields: bool = False,
    auto_aggregations: bool = False,
    use_aggregate_conditions: bool = False,
    allow_metric_aggregates: bool = False,
    transform_alias_to_input_format: bool = False,
    has_metrics: bool = False,
    functions_acl: Optional[Sequence[str]] = None,
    use_metrics_layer: bool = False,
) -> Any:
    if not selected_columns:
        raise InvalidSearchQuery("No columns selected")

    builder = ProfilesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
        query=query,
        selected_columns=selected_columns,
        orderby=orderby,
        auto_fields=auto_fields,
        auto_aggregations=auto_aggregations,
        use_aggregate_conditions=use_aggregate_conditions,
        functions_acl=functions_acl,
        limit=limit,
        offset=offset,
    )
    builder.run_query(referrer)

    return {
        "data": [],
        "meta": {},
    }


class ProfilesQueryBuilder(QueryBuilder):  # type: ignore
    def resolve_column_name(self, col: str) -> str:
        return self.config.resolve_column(col)

    def resolve_params(self) -> List[WhereType]:
        conditions = super().resolve_params()
        conditions.append(
            Condition(
                self.column("organization.id"),
                Op.IN,
                [self.params["organization_id"]],
            )
        )
        return conditions
