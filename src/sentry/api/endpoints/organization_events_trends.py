from datetime import datetime, timedelta
from typing import Dict, Match, Optional, TypedDict

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.expressions import Limit, Offset
from snuba_sdk.function import Function

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.event_search import AggregateFilter
from sentry.api.paginator import GenericOffsetPaginator
from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.datasets import function_aliases
from sentry.search.events.fields import DateArg, parse_function
from sentry.search.events.types import Alias, QueryBuilderConfig, SelectType, WhereType
from sentry.search.utils import InvalidQuery, parse_datetime_string
from sentry.snuba import discover
from sentry.snuba.dataset import Dataset
from sentry.utils.snuba import raw_snql_query


class TrendColumns(TypedDict):
    aggregate_range_1: SelectType
    aggregate_range_2: SelectType
    count_range_1: SelectType
    count_range_2: SelectType
    t_test: SelectType
    trend_percentage: SelectType
    trend_difference: SelectType
    count_percentage: SelectType


# This is to flip conditions between trend types
CORRESPONDENCE_MAP = {
    ">": "<",
    ">=": "<=",
    "<": ">",
    "<=": ">=",
    "=": "=",
    "!=": "!=",
}

IMPROVED = "improved"
REGRESSION = "regression"
TREND_TYPES = [IMPROVED, REGRESSION]


# TODO move this to the builder file and introduce a top-events version instead
class TrendQueryBuilder(QueryBuilder):
    def convert_aggregate_filter_to_condition(
        self, aggregate_filter: AggregateFilter
    ) -> Optional[WhereType]:
        name = aggregate_filter.key.name

        if name in self.params.aliases:
            return self.params.aliases[name].converter(aggregate_filter)
        else:
            return super().convert_aggregate_filter_to_condition(aggregate_filter)

    def resolve_function(
        self,
        function: str,
        match: Optional[Match[str]] = None,
        resolve_only=False,
        overwrite_alias: Optional[str] = None,
    ) -> SelectType:
        if function in self.params.aliases:
            return self.params.aliases[function].resolved_function
        else:
            return super().resolve_function(function, match, resolve_only, overwrite_alias)


class OrganizationEventsTrendsEndpointBase(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    trend_columns = {
        "p50": "percentile_range({column}, 0.5, {condition}, {boundary}) as {query_alias}",
        "p75": "percentile_range({column}, 0.75, {condition}, {boundary}) as {query_alias}",
        "p95": "percentile_range({column}, 0.95, {condition}, {boundary}) as {query_alias}",
        "p99": "percentile_range({column}, 0.99, {condition}, {boundary}) as {query_alias}",
        "avg": "avg_range({column}, {condition}, {boundary}) as {query_alias}",
        "variance": "variance_range(transaction.duration, {condition}, {boundary}) as {query_alias}",
        "count_range": "count_range({condition}, {boundary}) as {query_alias}",
        "percentage": "percentage({alias}_2, {alias}_1) as {query_alias}",
        "difference": "minus({alias}_2,{alias}_1) as {query_alias}",
        "t_test": "t_test({avg}_1, {avg}_2, variance_range_1, variance_range_2, count_range_1, count_range_2)",
    }

    snql_trend_columns = {
        "p50": "percentile_range({column}, 0.5, {condition}, {boundary})",
        "p75": "percentile_range({column}, 0.75, {condition}, {boundary})",
        "p95": "percentile_range({column}, 0.95, {condition}, {boundary})",
        "p99": "percentile_range({column}, 0.99, {condition}, {boundary})",
        "avg": "avg_range({column}, {condition}, {boundary})",
        "variance": "variance_range(transaction.duration, {condition}, {boundary})",
        "count_range": "count_range({condition}, {boundary})",
        "percentage": "percentage({alias}_2, {alias}_1)",
        "difference": "minus({alias}_2,{alias}_1)",
        "t_test": "t_test({avg}_1, {avg}_2, variance_range_1, variance_range_2, count_range_1, count_range_2)",
    }

    def resolve_trend_columns(
        self,
        query: TrendQueryBuilder,
        baseline_function: str,
        column: str,
        middle: str,
    ) -> TrendColumns:
        """Construct the columns needed to calculate high confidence trends

        This is the snql version of get_trend_columns, which should be replaced
        once we're migrated
        """
        if baseline_function not in self.snql_trend_columns:
            raise ParseError(detail=f"{baseline_function} is not a supported trend function")

        aggregate_column = self.snql_trend_columns[baseline_function]
        aggregate_range_1 = query.resolve_function(
            aggregate_column.format(column=column, condition="greater", boundary=middle),
            overwrite_alias="aggregate_range_1",
        )
        aggregate_range_2 = query.resolve_function(
            aggregate_column.format(
                column=column,
                condition="lessOrEquals",
                boundary=middle,
            ),
            overwrite_alias="aggregate_range_2",
        )

        count_column = self.snql_trend_columns["count_range"]
        count_range_1 = query.resolve_function(
            count_column.format(condition="greater", boundary=middle),
            overwrite_alias="count_range_1",
        )
        count_range_2 = query.resolve_function(
            count_column.format(condition="lessOrEquals", boundary=middle),
            overwrite_alias="count_range_2",
        )

        variance_column = self.snql_trend_columns["variance"]
        variance_range_1 = query.resolve_function(
            variance_column.format(condition="greater", boundary=middle),
            overwrite_alias="variance_range_1",
        )
        variance_range_2 = query.resolve_function(
            variance_column.format(condition="lessOrEquals", boundary=middle),
            overwrite_alias="variance_range_2",
        )
        # Only add average when its not the baseline
        if baseline_function != "avg":
            avg_column = self.snql_trend_columns["avg"]
            avg_range_1 = query.resolve_function(
                avg_column.format(
                    column=column,
                    condition="greater",
                    boundary=middle,
                )
            )
            avg_range_2 = query.resolve_function(
                avg_column.format(
                    column=column,
                    condition="lessOrEquals",
                    boundary=middle,
                )
            )
        # avg will be added as the baseline
        else:
            avg_range_1 = aggregate_range_1
            avg_range_2 = aggregate_range_2

        t_test = function_aliases.resolve_division(
            Function("minus", [avg_range_1, avg_range_2]),
            Function(
                "sqrt",
                [
                    Function(
                        "plus",
                        [
                            Function(
                                "divide",
                                [
                                    variance_range_1,
                                    count_range_1,
                                ],
                            ),
                            Function(
                                "divide",
                                [
                                    variance_range_2,
                                    count_range_2,
                                ],
                            ),
                        ],
                    ),
                ],
            ),
            "t_test",
        )
        trend_percentage = function_aliases.resolve_division(
            aggregate_range_2, aggregate_range_1, "trend_percentage"
        )
        trend_difference = Function(
            "minus",
            [
                aggregate_range_2,
                aggregate_range_1,
            ],
            "trend_difference",
        )
        count_percentage = function_aliases.resolve_division(
            count_range_2, count_range_1, "count_percentage"
        )
        return {
            "aggregate_range_1": aggregate_range_1,
            "aggregate_range_2": aggregate_range_2,
            "count_range_1": count_range_1,
            "count_range_2": count_range_2,
            "t_test": t_test,
            "trend_percentage": trend_percentage,
            "trend_difference": trend_difference,
            "count_percentage": count_percentage,
        }

    @staticmethod
    def get_snql_function_aliases(trend_columns: TrendColumns, trend_type: str) -> Dict[str, Alias]:
        """Construct a dict of aliases

        this is because certain conditions behave differently depending on the trend type
        like trend_percentage and trend_difference
        """
        return {
            "trend_percentage()": Alias(
                lambda aggregate_filter: Condition(
                    trend_columns["trend_percentage"],
                    Op(
                        CORRESPONDENCE_MAP[aggregate_filter.operator]
                        if trend_type == IMPROVED
                        else aggregate_filter.operator
                    ),
                    1 + (aggregate_filter.value.value * (-1 if trend_type == IMPROVED else 1)),
                ),
                ["percentage", "transaction.duration"],
                trend_columns["trend_percentage"],
            ),
            "trend_difference()": Alias(
                lambda aggregate_filter: Condition(
                    trend_columns["trend_difference"],
                    Op(
                        CORRESPONDENCE_MAP[aggregate_filter.operator]
                        if trend_type == IMPROVED
                        else aggregate_filter.operator
                    ),
                    -1 * aggregate_filter.value.value
                    if trend_type == IMPROVED
                    else aggregate_filter.value.value,
                ),
                ["minus", "transaction.duration"],
                trend_columns["trend_difference"],
            ),
            "confidence()": Alias(
                lambda aggregate_filter: Condition(
                    trend_columns["t_test"],
                    Op(
                        CORRESPONDENCE_MAP[aggregate_filter.operator]
                        if trend_type == REGRESSION
                        else aggregate_filter.operator
                    ),
                    -1 * aggregate_filter.value.value
                    if trend_type == REGRESSION
                    else aggregate_filter.value.value,
                ),
                None,
                trend_columns["t_test"],
            ),
            "count_percentage()": Alias(
                lambda aggregate_filter: Condition(
                    trend_columns["count_percentage"],
                    Op(aggregate_filter.operator),
                    aggregate_filter.value.value,
                ),
                ["percentage", "count"],
                trend_columns["count_percentage"],
            ),
        }

    @staticmethod
    def get_function_aliases(trend_type):
        """Construct the dict of aliases

        trend_percentage and trend_difference behave differently depending on the trend type
        """
        return {
            "trend_percentage()": Alias(
                lambda aggregate_filter: [
                    "trend_percentage",
                    CORRESPONDENCE_MAP[aggregate_filter.operator]
                    if trend_type == IMPROVED
                    else aggregate_filter.operator,
                    1 + (aggregate_filter.value.value * (-1 if trend_type == IMPROVED else 1)),
                ],
                ["percentage", "transaction.duration"],
                None,
            ),
            "trend_difference()": Alias(
                lambda aggregate_filter: [
                    "trend_difference",
                    CORRESPONDENCE_MAP[aggregate_filter.operator]
                    if trend_type == IMPROVED
                    else aggregate_filter.operator,
                    -1 * aggregate_filter.value.value
                    if trend_type == IMPROVED
                    else aggregate_filter.value.value,
                ],
                ["minus", "transaction.duration"],
                None,
            ),
            "confidence()": Alias(
                lambda aggregate_filter: [
                    "t_test",
                    CORRESPONDENCE_MAP[aggregate_filter.operator]
                    if trend_type == REGRESSION
                    else aggregate_filter.operator,
                    -1 * aggregate_filter.value.value
                    if trend_type == REGRESSION
                    else aggregate_filter.value.value,
                ],
                None,
                None,
            ),
            "count_percentage()": Alias(
                lambda aggregate_filter: [
                    "count_percentage",
                    aggregate_filter.operator,
                    aggregate_filter.value.value,
                ],
                ["percentage", "count"],
                None,
            ),
        }

    def get_trend_columns(self, baseline_function, column, middle):
        """Construct the columns needed to calculate high confidence trends"""
        trend_column = self.trend_columns.get(baseline_function)
        if trend_column is None:
            raise ParseError(detail=f"{baseline_function} is not a supported trend function")

        count_column = self.trend_columns["count_range"]
        percentage_column = self.trend_columns["percentage"]
        variance_column = self.trend_columns["variance"]

        # t_test, and the columns required to calculate it
        t_test_columns = [
            variance_column.format(
                condition="greater", boundary=middle, query_alias="variance_range_1"
            ),
            variance_column.format(
                condition="lessOrEquals", boundary=middle, query_alias="variance_range_2"
            ),
        ]
        # Only add average when its not the baseline
        if baseline_function != "avg":
            avg_column = self.trend_columns["avg"]
            t_test_columns.extend(
                [
                    avg_column.format(
                        column=column,
                        condition="greater",
                        boundary=middle,
                        query_alias="avg_range_1",
                    ),
                    avg_column.format(
                        column=column,
                        condition="lessOrEquals",
                        boundary=middle,
                        query_alias="avg_range_2",
                    ),
                ]
            )
            avg_alias = "avg_range"
        # avg will be added as the baseline
        else:
            avg_alias = "aggregate_range"

        t_test_columns.append(
            self.trend_columns["t_test"].format(
                avg=avg_alias,
            )
        )

        return t_test_columns + [
            trend_column.format(
                column=column, condition="greater", boundary=middle, query_alias="aggregate_range_1"
            ),
            trend_column.format(
                column=column,
                condition="lessOrEquals",
                boundary=middle,
                query_alias="aggregate_range_2",
            ),
            percentage_column.format(alias="aggregate_range", query_alias="trend_percentage"),
            self.trend_columns["difference"].format(
                alias="aggregate_range", query_alias="trend_difference"
            ),
            count_column.format(condition="greater", boundary=middle, query_alias="count_range_1"),
            count_column.format(
                condition="lessOrEquals", boundary=middle, query_alias="count_range_2"
            ),
            percentage_column.format(alias="count_range", query_alias="count_percentage"),
        ]

    def has_feature(self, organization, request):
        return features.has("organizations:performance-view", organization, actor=request.user)

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        with sentry_sdk.start_span(op="discover.endpoint", description="trend_dates"):
            middle_date = request.GET.get("middle")
            if middle_date:
                try:
                    middle = parse_datetime_string(middle_date)
                except InvalidQuery:
                    raise ParseError(detail=f"{middle_date} is not a valid date format")
                if middle <= params["start"] or middle >= params["end"]:
                    raise ParseError(
                        detail="The middle date should be within the duration of the query"
                    )
            else:
                middle = params["start"] + timedelta(
                    seconds=(params["end"] - params["start"]).total_seconds() * 0.5
                )
            middle = datetime.strftime(middle, DateArg.date_format)

        trend_type = request.GET.get("trendType", REGRESSION)
        if trend_type not in TREND_TYPES:
            raise ParseError(detail=f"{trend_type} is not a supported trend type")

        trend_function = request.GET.get("trendFunction", "p50()")
        try:
            function, columns, _ = parse_function(trend_function)
        except InvalidSearchQuery as error:
            raise ParseError(detail=error)
        if len(columns) == 0:
            # Default to duration
            column = "transaction.duration"
        else:
            column = columns[0]

        selected_columns = self.get_field_list(organization, request)
        orderby = self.get_orderby(request)
        query = request.GET.get("query")

        with self.handle_query_errors():
            trend_query = TrendQueryBuilder(
                dataset=Dataset.Discover,
                params=params,
                selected_columns=selected_columns,
                config=QueryBuilderConfig(
                    auto_fields=False,
                    auto_aggregations=True,
                    use_aggregate_conditions=True,
                ),
            )
            snql_trend_columns = self.resolve_trend_columns(trend_query, function, column, middle)
            trend_query.columns.extend(snql_trend_columns.values())
            trend_query.aggregates.extend(snql_trend_columns.values())
            trend_query.params.aliases = self.get_snql_function_aliases(
                snql_trend_columns, trend_type
            )
            # Both orderby and conditions need to be resolved after the columns because of aliasing
            trend_query.orderby = trend_query.resolve_orderby(orderby)
            trend_query.groupby = trend_query.resolve_groupby()
            where, having = trend_query.resolve_conditions(query)
            trend_query.where += where
            trend_query.having += having

        def data_fn(offset, limit):
            trend_query.offset = Offset(offset)
            trend_query.limit = Limit(limit)
            result = raw_snql_query(
                trend_query.get_snql_query(),
                referrer="api.trends.get-percentage-change",
            )
            result = trend_query.process_results(result)
            return result

        with self.handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=self.build_result_handler(
                    request,
                    organization,
                    params,
                    trend_function,
                    selected_columns,
                    orderby,
                    query,
                ),
                default_per_page=5,
                max_per_page=5,
            )


@region_silo_endpoint
class OrganizationEventsTrendsStatsEndpoint(OrganizationEventsTrendsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def build_result_handler(
        self,
        request,
        organization,
        params,
        trend_function,
        selected_columns,
        orderby,
        query,
    ):
        def on_results(events_results):
            def get_event_stats(query_columns, query, params, rollup, zerofill_results, _=None):
                return discover.top_events_timeseries(
                    query_columns,
                    selected_columns,
                    query,
                    params,
                    orderby,
                    rollup,
                    min(5, len(events_results["data"])),
                    organization,
                    top_events=events_results,
                    referrer="api.trends.get-event-stats",
                    zerofill_results=zerofill_results,
                )

            stats_results = (
                self.get_event_stats_data(
                    request,
                    organization,
                    get_event_stats,
                    top_events=True,
                    query_column=trend_function,
                    params=params,
                    query=query,
                )
                if len(events_results["data"]) > 0
                else {}
            )

            return {
                "events": self.handle_results_with_meta(
                    request, organization, params["project_id"], events_results
                ),
                "stats": stats_results,
            }

        return on_results


@region_silo_endpoint
class OrganizationEventsTrendsEndpoint(OrganizationEventsTrendsEndpointBase):
    def build_result_handler(
        self,
        request,
        organization,
        params,
        trend_function,
        selected_columns,
        orderby,
        query,
    ):
        return lambda events_results: self.handle_results_with_meta(
            request, organization, params["project_id"], events_results
        )
