from __future__ import annotations

from typing import Callable, Mapping, Optional

from snuba_sdk import Column, Function, OrderBy

from sentry.api.event_search import SearchFilter
from sentry.exceptions import IncompatibleMetricsQuery
from sentry.search.events import builder, constants, fields
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.types import SelectType, WhereType


class SpansMetricsDatasetConfig(DatasetConfig):
    missing_function_error = IncompatibleMetricsQuery

    def __init__(self, builder: builder.SpansMetricsQueryBuilder):
        self.builder = builder

    @property
    def search_filter_converter(
        self,
    ) -> Mapping[str, Callable[[SearchFilter], Optional[WhereType]]]:
        return {}

    @property
    def field_alias_converter(self) -> Mapping[str, Callable[[str], SelectType]]:
        return {}

    def resolve_metric(self, value: str) -> int:
        metric_id = self.builder.resolve_metric_index(constants.SPAN_METRICS_MAP.get(value, value))
        # If its still None its not a custom measurement
        if metric_id is None:
            raise IncompatibleMetricsQuery(f"Metric: {value} could not be resolved")
        self.builder.metric_ids.add(metric_id)
        return metric_id

    def resolve_value(self, value: str) -> int:
        value_id = self.builder.resolve_tag_value(value)

        return value_id

    @property
    def function_converter(self) -> Mapping[str, fields.MetricsFunction]:
        """While the final functions in clickhouse must have their -Merge combinators in order to function, we don't
        need to add them here since snuba has a FunctionMapper that will add it for us. Basically it turns expressions
        like quantiles(0.9)(value) into quantilesMerge(0.9)(percentiles)
        Make sure to update METRIC_FUNCTION_LIST_BY_TYPE when adding functions here, can't be a dynamic list since the
        Metric Layer will actually handle which dataset each function goes to
        """
        resolve_metric_id = {
            "name": "metric_id",
            "fn": lambda args: self.resolve_metric(args["column"]),
        }

        function_converter = {
            function.name: function
            for function in [
                fields.MetricsFunction(
                    "count_unique",
                    required_args=[
                        fields.MetricArg(
                            "column", allowed_columns=["user"], allow_custom_measurements=False
                        )
                    ],
                    calculated_args=[resolve_metric_id],
                    snql_set=lambda args, alias: Function(
                        "uniqIf",
                        [
                            Column("value"),
                            Function("equals", [Column("metric_id"), args["metric_id"]]),
                        ],
                        alias,
                    ),
                    default_result_type="integer",
                ),
            ]
        }

        for alias, name in constants.FUNCTION_ALIASES.items():
            if name in function_converter:
                function_converter[alias] = function_converter[name].alias_as(alias)

        return function_converter

    @property
    def orderby_converter(self) -> Mapping[str, OrderBy]:
        return {}
