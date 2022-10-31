from datetime import datetime
from typing import Any, List, Optional, Protocol

from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op

from sentry.search.events.builder import QueryBuilder, TimeseriesQueryBuilder
from sentry.search.events.datasets.profiles import ProfilesDatasetConfig
from sentry.search.events.fields import InvalidSearchQuery, get_json_meta_type
from sentry.search.events.types import ParamsType, WhereType
from sentry.snuba.discover import transform_tips, zerofill
from sentry.utils.snuba import Dataset, SnubaTSResult


def query(
    selected_columns: List[str],
    query: Optional[str],
    params: ParamsType,
    equations: Optional[List[str]] = None,
    orderby: Optional[List[str]] = None,
    offset: int = 0,
    limit: int = 50,
    referrer: str = "",
    auto_fields: bool = False,
    auto_aggregations: bool = False,
    use_aggregate_conditions: bool = False,
    allow_metric_aggregates: bool = False,
    transform_alias_to_input_format: bool = False,
    has_metrics: bool = False,
    functions_acl: Optional[List[str]] = None,
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


def timeseries_query(
    selected_columns: List[str],
    query: Optional[str],
    params: ParamsType,
    rollup: int,
    referrer: str = "",
    zerofill_results: bool = True,
    comparison_delta: Optional[datetime] = None,
    functions_acl: Optional[List[str]] = None,
    allow_metric_aggregates: bool = False,
    has_metrics: bool = False,
) -> Any:
    builder = ProfilesTimeseriesQueryBuilder(
        dataset=Dataset.Profiles,
        params=params,
        interval=rollup,
        selected_columns=selected_columns,
        functions_acl=functions_acl,
    )
    results = builder.run_query(referrer)

    return SnubaTSResult(
        {
            "data": zerofill(
                results["data"],
                params["start"],
                params["end"],
                rollup,
                "time",
            )
            if zerofill_results
            else results["data"],
            "meta": {
                "fields": {
                    value["name"]: get_json_meta_type(value["name"], value.get("type"), builder)
                    for value in results["meta"]
                }
            },
        },
        params["start"],
        params["end"],
        rollup,
    )


class ProfilesQueryBuilderProtocol(Protocol):
    @property
    def config(self) -> ProfilesDatasetConfig:
        ...

    @property
    def params(self) -> ParamsType:
        ...

    def column(self, name: str) -> Column:
        ...

    def resolve_params(self) -> List[WhereType]:
        ...


class ProfilesQueryBuilderMixin:
    def resolve_column_name(self: ProfilesQueryBuilderProtocol, col: str) -> str:
        # giving resolved a type here convinces mypy that the type is str
        resolved: str = self.config.resolve_column(col)
        return resolved

    def resolve_params(self: ProfilesQueryBuilderProtocol) -> List[WhereType]:
        # not sure how to make mypy happy here as `super()`
        # refers to the other parent query builder class
        conditions: List[WhereType] = super().resolve_params()  # type: ignore

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

    def get_field_type(self: ProfilesQueryBuilderProtocol, field: str) -> Optional[str]:
        # giving resolved a type here convinces mypy that the type is str
        resolved: Optional[str] = self.config.resolve_column_type(field)
        return resolved


class ProfilesQueryBuilder(ProfilesQueryBuilderMixin, QueryBuilder):
    pass


class ProfilesTimeseriesQueryBuilder(ProfilesQueryBuilderMixin, TimeseriesQueryBuilder):
    pass
