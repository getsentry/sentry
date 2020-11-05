from __future__ import absolute_import

from collections import namedtuple
import sentry_sdk

from datetime import datetime, timedelta
from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry import features
from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.api.event_search import DateArg, parse_function
from sentry.api.paginator import GenericOffsetPaginator
from sentry.snuba import discover


# converter is to convert the aggregate filter to snuba query
Alias = namedtuple("Alias", "converter aggregate")


# This is to flip conditions beteween trend types
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


class OrganizationEventsTrendsEndpointBase(OrganizationEventsV2EndpointBase):
    trend_columns = {
        "p50": "percentile_range(transaction.duration, 0.5, {start}, {end}, {query_alias})",
        "p75": "percentile_range(transaction.duration, 0.75, {start}, {end}, {query_alias})",
        "p95": "percentile_range(transaction.duration, 0.95, {start}, {end}, {query_alias})",
        "p99": "percentile_range(transaction.duration, 0.99, {start}, {end}, {query_alias})",
        "avg": "avg_range(transaction.duration, {start}, {end}, {query_alias})",
        "variance": "variance_range(transaction.duration, {start}, {end}, {query_alias})",
        "count_range": "count_range({start}, {end}, {query_alias})",
        "percentage": "percentage({alias}_2, {alias}_1, {query_alias})",
        "difference": "minus({alias}_2,{alias}_1, {query_alias})",
        "t_test": "t_test({avg}_1, {avg}_2, variance_range_1, variance_range_2, count_range_1, count_range_2)",
    }

    @staticmethod
    def get_function_aliases(trend_type):
        """ Construct the dict of aliases

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
            ),
            "t_test()": Alias(
                lambda aggregate_filter: [
                    "t_test",
                    aggregate_filter.operator,
                    aggregate_filter.value.value,
                ],
                None,
            ),
            "count_percentage()": Alias(
                lambda aggregate_filter: [
                    "count_percentage",
                    aggregate_filter.operator,
                    aggregate_filter.value.value,
                ],
                ["percentage", "count"],
            ),
        }

    def get_trend_columns(self, baseline_function, columns, start, middle, end):
        """ Construct the columns needed to calculate high confidence trends """
        trend_column = self.trend_columns.get(baseline_function)
        if trend_column is None:
            raise ParseError(
                detail=u"{} is not a supported trend function".format(baseline_function)
            )

        count_column = self.trend_columns["count_range"]
        percentage_column = self.trend_columns["percentage"]
        variance_column = self.trend_columns["variance"]

        # t_test, and the columns required to calculate it
        t_test_columns = [
            variance_column.format(start=start, end=middle, query_alias="variance_range_1"),
            variance_column.format(start=middle, end=end, query_alias="variance_range_2"),
        ]
        # Only add average when its not the baseline
        if baseline_function != "avg":
            avg_column = self.trend_columns["avg"]
            t_test_columns.extend(
                [
                    avg_column.format(start=start, end=middle, query_alias="avg_range_1"),
                    avg_column.format(start=middle, end=end, query_alias="avg_range_2"),
                ]
            )
            avg_alias = "avg_range"
        # avg will be added as the baseline
        else:
            avg_alias = "aggregate_range"

        t_test_columns.append(self.trend_columns["t_test"].format(avg=avg_alias,))

        return t_test_columns + [
            trend_column.format(*columns, start=start, end=middle, query_alias="aggregate_range_1"),
            trend_column.format(*columns, start=middle, end=end, query_alias="aggregate_range_2"),
            percentage_column.format(alias="aggregate_range", query_alias="trend_percentage"),
            self.trend_columns["difference"].format(
                alias="aggregate_range", query_alias="trend_difference"
            ),
            count_column.format(start=start, end=middle, query_alias="count_range_1"),
            count_column.format(start=middle, end=end, query_alias="count_range_2"),
            percentage_column.format(alias="count_range", query_alias="count_percentage"),
        ]

    def has_feature(self, organization, request):
        return features.has("organizations:trends", organization, actor=request.user)

    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        with sentry_sdk.start_span(op="discover.endpoint", description="trend_dates"):
            middle = params["start"] + timedelta(
                seconds=(params["end"] - params["start"]).total_seconds() * 0.5
            )
            start, middle, end = (
                datetime.strftime(params["start"], DateArg.date_format),
                datetime.strftime(middle, DateArg.date_format),
                datetime.strftime(params["end"], DateArg.date_format),
            )

        trend_type = request.GET.get("trendType", REGRESSION)
        if trend_type not in TREND_TYPES:
            raise ParseError(detail=u"{} is not a supported trend type".format(trend_type))

        params["aliases"] = self.get_function_aliases(trend_type)

        trend_function = request.GET.get("trendFunction", "p50()")
        function, columns = parse_function(trend_function)
        trend_columns = self.get_trend_columns(function, columns, start, middle, end)

        selected_columns = request.GET.getlist("field")[:]
        orderby = self.get_orderby(request)

        query = request.GET.get("query")

        def data_fn(offset, limit):
            return discover.query(
                selected_columns=selected_columns + trend_columns,
                query=query,
                params=params,
                orderby=orderby,
                offset=offset,
                limit=limit,
                referrer="api.trends.get-percentage-change",
                auto_fields=True,
                auto_aggregations=True,
                use_aggregate_conditions=True,
            )

        with self.handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=self.build_result_handler(
                    request, organization, params, trend_function, selected_columns, orderby, query
                ),
                default_per_page=5,
                max_per_page=5,
            )


class OrganizationEventsTrendsStatsEndpoint(OrganizationEventsTrendsEndpointBase):
    def build_result_handler(
        self, request, organization, params, trend_function, selected_columns, orderby, query
    ):
        def on_results(events_results):
            def get_event_stats(query_columns, query, params, rollup):
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


class OrganizationEventsTrendsEndpoint(OrganizationEventsTrendsEndpointBase):
    def build_result_handler(
        self, request, organization, params, trend_function, selected_columns, orderby, query
    ):
        return lambda events_results: self.handle_results_with_meta(
            request, organization, params["project_id"], events_results
        )
