from typing import Any, List, Optional, Sequence

from snuba_sdk.conditions import Condition, Op

from sentry.search.events.builder import QueryBuilder
from sentry.search.events.fields import InvalidSearchQuery
from sentry.search.events.types import ParamsType, WhereType
from sentry.snuba.discover import transform_tips
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
    result = builder.process_results(builder.run_query(referrer))
    result["meta"]["tips"] = transform_tips(builder.tips)
    return result


class ProfilesQueryBuilder(QueryBuilder):  # type: ignore
    def resolve_column_name(self, col: str) -> str:
        return self.config.resolve_column(col)

    def resolve_params(self) -> List[WhereType]:
        conditions = super().resolve_params()

        # the profiles dataset requires a condition
        # on the organization_id in the query
        conditions.append(
            Condition(
                self.column("organization.id"),
                Op.EQ,
                self.params["organization_id"],
            )
        )

        return conditions

    def get_field_type(self, field: str) -> Optional[str]:
        return self.config.resolve_column_type(field)
