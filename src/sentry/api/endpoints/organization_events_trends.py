from __future__ import absolute_import

import sentry_sdk

from datetime import datetime, timedelta
from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry import features
from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.api.event_search import DateArg, parse_function
from sentry.snuba import discover


class OrganizationEventsTrendsEndpoint(OrganizationEventsV2EndpointBase):
    trend_columns = {
        "p50": {
            "format": "percentile_range(transaction.duration, 0.5, {start}, {end}, {index})",
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
    }

    def has_feature(self, organization, request):
        return features.has("organizations:internal-catchall", organization, actor=request.user)

    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        with sentry_sdk.start_span(op="discover.endpoint", description="filter_params") as span:
            span.set_tag("organization", organization)
            try:
                params = self.get_filter_params(request, organization)
            except NoProjects:
                return Response([])
            params = self.quantize_date_params(request, params)

            has_global_views = features.has(
                "organizations:global-views", organization, actor=request.user
            )
            if not has_global_views and len(params.get("project_id", [])) > 1:
                raise ParseError(detail="You cannot view events from multiple projects.")

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
        selected_columns = request.GET.getlist("field")[:]
        query = request.GET.get("query")
        orderby = self.get_orderby(request)

        with self.handle_query_errors():
            events_results = discover.query(
                selected_columns=selected_columns
                + [
                    trend_column["format"].format(*columns, start=start, end=middle, index="1"),
                    trend_column["format"].format(*columns, start=middle, end=end, index="2"),
                    "divide({alias}2,{alias}1)".format(alias=trend_column["alias"]),
                    "minus({alias}2,{alias}1)".format(alias=trend_column["alias"]),
                    count_column["format"].format(start=start, end=middle, index="1"),
                    count_column["format"].format(start=middle, end=end, index="2"),
                    "divide({alias}2,{alias}1)".format(alias=count_column["alias"]),
                ],
                query=query,
                params=params,
                orderby=orderby,
                limit=5,
                referrer="api.trends.get-percentage-change",
                auto_fields=True,
                use_aggregate_conditions=True,
            )

        def get_event_stats(query_columns, query, params, rollup, reference_event):
            return discover.top_events_timeseries(
                query_columns,
                selected_columns,
                query,
                params,
                orderby,
                rollup,
                5,
                organization,
                top_events=events_results,
                referrer="api.trends.get-event-stats",
            )

        stats_results = self.get_event_stats_data(
            request, organization, get_event_stats, top_events=True, query_column=trend_function
        )

        return Response(
            {
                "events": self.handle_results_with_meta(
                    request, organization, params["project_id"], events_results, omit_nan=True
                ),
                "stats": stats_results,
            }
        )
