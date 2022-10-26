from typing import Any, List, Optional, Sequence

from snuba_sdk.conditions import Condition, Op

from sentry.search.events.builder import QueryBuilder
from sentry.search.events.fields import InvalidSearchQuery
from sentry.search.events.types import ParamsType, WhereType
from sentry.snuba.discover import EventsResponse, transform_data, transform_meta
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
    results = builder.run_query(referrer)

    # TODO: fix this block up
    translated_columns = {}
    if transform_alias_to_input_format:
        translated_columns = {
            column: function_details.field
            for column, function_details in builder.function_alias_map.items()
        }
        builder.function_alias_map = {
            translated_columns.get(column): function_details
            for column, function_details in builder.function_alias_map.items()
        }
    final_results: EventsResponse = transform_data(results, translated_columns, builder)
    final_results["meta"] = transform_meta(final_results, builder)
    for key, value in final_results["meta"].items():
        if value == "duration":
            final_results["meta"][key] = "nanosecond"

    return final_results


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
