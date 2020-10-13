from __future__ import absolute_import

import sentry_sdk

from datetime import datetime, timedelta
from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry import features
from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.api.event_search import DateArg, parse_function
from sentry.api.paginator import GenericOffsetPaginator
from sentry.snuba import discover


class OrganizationEventsTrendsEndpointBase(OrganizationEventsV2EndpointBase):
    trend_columns = {
        "p50": {
            "format": "percentile_range(transaction.duration, 0.5, {start}, {end}, {index})",
            "alias": "percentile_range_",
        },
        "p75": {
            "format": "percentile_range(transaction.duration, 0.75, {start}, {end}, {index})",
            "alias": "percentile_range_",
        },
        "p95": {
            "format": "percentile_range(transaction.duration, 0.95, {start}, {end}, {index})",
            "alias": "percentile_range_",
        },
        "p99": {
            "format": "percentile_range(transaction.duration, 0.99, {start}, {end}, {index})",
            "alias": "percentile_range_",
        },
        "avg": {
            "format": "avg_range(transaction.duration, {start}, {end}, {index})",
            "alias": "avg_range_",
        },
        "user_misery": {
            "format": "user_misery_range({}, {start}, {end}, {index})",
            "alias": "user_misery_range_",
        },
        "count_range": {"format": "count_range({start}, {end}, {index})", "alias": "count_range_"},
        "percentage": {"format": "percentage({alias}2, {alias}1)"},
    }
    # Aggregations that will be automatically added if they're included in the query
    # this is so they're only added as needed
    auto_aggregations = [
        "p50()",
        "p75()",
        "p95()",
        "p99()",
        "avg(transaction.duration)",
        "count()",
        "absolute_correlation()",
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

        trend_function = request.GET.get("trendFunction", "p50()")
        function, columns = parse_function(trend_function)
        trend_column = self.trend_columns.get(function)
        if trend_column is None:
            raise ParseError(detail=u"{} is not a supported trend function".format(trend_function))

        count_column = self.trend_columns.get("count_range")
        percentage_column = self.trend_columns["percentage"]
        selected_columns = request.GET.getlist("field")[:]
        query = request.GET.get("query")
        orderby = self.get_orderby(request)

        def data_fn(offset, limit):
            return discover.query(
                selected_columns=selected_columns
                + [
                    trend_column["format"].format(*columns, start=start, end=middle, index="1"),
                    trend_column["format"].format(*columns, start=middle, end=end, index="2"),
                    percentage_column["format"].format(alias=trend_column["alias"]),
                    "minus({alias}2,{alias}1)".format(alias=trend_column["alias"]),
                    count_column["format"].format(start=start, end=middle, index="1"),
                    count_column["format"].format(start=middle, end=end, index="2"),
                    percentage_column["format"].format(alias=count_column["alias"]),
                ],
                query=query,
                params=params,
                orderby=orderby,
                offset=offset,
                limit=limit,
                referrer="api.trends.get-percentage-change",
                auto_fields=True,
                auto_aggregations=self.auto_aggregations,
                use_aggregate_conditions=True,
            )

        with self.handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=self.build_result_handler(
                    request, organization, params, trend_function, selected_columns, orderby
                ),
                default_per_page=5,
                max_per_page=5,
            )


class OrganizationEventsTrendsStatsEndpoint(OrganizationEventsTrendsEndpointBase):
    def build_result_handler(
        self, request, organization, params, trend_function, selected_columns, orderby
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
        self, request, organization, params, trend_function, selected_columns, orderby
    ):
        return lambda events_results: self.handle_results_with_meta(
            request, organization, params["project_id"], events_results
        )
