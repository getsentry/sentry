import logging

import sentry_sdk
from django.conf import settings
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column
from urllib3 import Retry

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.net.http import connection_from_url
from sentry.snuba import metrics_performance
from sentry.snuba.discover import create_result_key, zerofill
from sentry.snuba.metrics_performance import query
from sentry.snuba.referrer import Referrer
from sentry.utils import json
from sentry.utils.snuba import SnubaTSResult

logger = logging.getLogger(__name__)


IMPROVED = "improved"
REGRESSION = "regression"
TREND_TYPES = [IMPROVED, REGRESSION]

ads_connection_pool = connection_from_url(
    settings.ANOMALY_DETECTION_URL,
    retries=Retry(
        total=5,
        status_forcelist=[408, 429, 502, 503, 504],
    ),
    timeout=settings.ANOMALY_DETECTION_TIMEOUT,
)


def get_trends(snuba_io):
    response = ads_connection_pool.urlopen(
        "POST",
        "/trends/breakpoint-detector",
        body=json.dumps(snuba_io),
        headers={"content-type": "application/json;charset=utf-8"},
    )
    return json.loads(response.data)


@region_silo_endpoint
class OrganizationEventsNewTrendsStatsEndpoint(OrganizationEventsV2EndpointBase):
    def has_feature(self, organization, request):
        return features.has(
            "organizations:performance-new-trends", organization, actor=request.user
        )

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        trend_type = request.GET.get("trendType", REGRESSION)
        if trend_type not in TREND_TYPES:
            raise ParseError(detail=f"{trend_type} is not a supported trend type")

        trend_function = request.GET.get("trendFunction", "p50()")

        selected_columns = self.get_field_list(organization, request)

        _query = request.GET.get("query")

        selected_columns.append(trend_function)
        selected_columns.append("count()")
        request.yAxis = selected_columns
        top_events_limit = 56
        events_per_query = 8

        def get_top_events(selected_columns, user_query, params, orderby, limit, referrer):
            return query(
                selected_columns,
                query=user_query,
                params=params,
                orderby=orderby,
                limit=limit,
                referrer=referrer,
                auto_aggregations=True,
                use_aggregate_conditions=True,
            )

        def generate_top_transaction_query(events):
            top_transaction_names = [event.get("transaction") for event in events]
            top_transaction_as_str = ", ".join(
                f'"{transaction}"' for transaction in top_transaction_names
            )
            return f" transaction:[{top_transaction_as_str}]"

        def get_event_stats_metrics(_, user_query, params, rollup, zerofill_results, __):
            # Get top events
            top_events = get_top_events(
                selected_columns,
                user_query=user_query,
                params=params,
                orderby=["-count()"],
                limit=top_events_limit,
                referrer=Referrer.API_TRENDS_GET_EVENT_STATS_V2_TOP_EVENTS.value,
            )

            sentry_sdk.set_tag(
                "performance.trendsv2.top_events", top_events.get("data", None) is not None
            )
            if top_events.get("data", None) is None:
                return {}

            data = top_events["data"]
            split_top_events = [
                data[i : i + events_per_query] for i in range(0, len(data), events_per_query)
            ]
            new_queries = [
                user_query + generate_top_transaction_query(t_e) for t_e in split_top_events
            ]

            result = metrics_performance.bulk_timeseries_query(
                selected_columns,
                new_queries,
                params,
                rollup=rollup,
                zerofill_results=zerofill_results,
                referrer=Referrer.API_TRENDS_GET_EVENT_STATS_V2_TIMESERIES.value,
                groupby=Column("transaction"),
                apply_formatting=False,
            )

            translated_groupby = ["transaction"]

            results = {}
            formatted_results = {}
            for index, item in enumerate(top_events["data"]):
                result_key = create_result_key(item, translated_groupby, {})
                results[result_key] = {"order": index, "data": [], "project": item["project"]}
            for row in result["data"]:
                result_key = create_result_key(row, translated_groupby, {})
                if result_key in results:
                    results[result_key]["data"].append(row)
                else:
                    # TODO filter out entries that don't have transaction or trend_function
                    logger.warning(
                        "trends.top-events.timeseries.key-mismatch",
                        extra={"result_key": result_key, "top_event_keys": list(results.keys())},
                    )
            for key, item in results.items():
                key = f'{item["project"]},{key}'
                formatted_results[key] = SnubaTSResult(
                    {
                        "data": zerofill(
                            item["data"], params["start"], params["end"], rollup, "time"
                        )
                        if zerofill_results
                        else item["data"],
                        "project": item["project"],
                        "isMetricsData": True,
                        "order": item["order"],
                        "meta": result["meta"],
                    },
                    params["start"],
                    params["end"],
                    rollup,
                )
            return formatted_results

        try:
            stats_data = self.get_event_stats_data(
                request,
                organization,
                get_event_stats_metrics,
                top_events=events_per_query,
                query_column=trend_function,
                params=params,
                query=_query,
                additional_query_column="count()",
            )

            sentry_sdk.set_tag("performance.trendsv2.stats_data", bool(stats_data))

            # handle empty response
            if not bool(stats_data):
                return Response(
                    {
                        "events": self.handle_results_with_meta(
                            request,
                            organization,
                            params["project_id"],
                            {"data": [], "meta": {"isMetricsData": True}},
                            True,
                        ),
                        "stats": {},
                    },
                    status=200,
                )

            response = Response(stats_data)

            trends_request = {
                "data": None,
                "sort": None,
                "trendFunction": None,
                "start": None,
                "end": None,
            }

            trends_request["sort"] = request.GET.get("sort", "trend_percentage()")
            trends_request["trendFunction"] = trend_function
            trends_request["data"] = response.data

            # get start and end from the first transaction
            trends_request["start"] = response.data[list(response.data)[0]][trend_function]["start"]
            trends_request["end"] = response.data[list(response.data)[0]][trend_function]["end"]

            # send the data to microservice
            trends = get_trends(trends_request)
            sentry_sdk.set_tag("performance.trendsv2.trends", len(trends.get("data", [])) > 0)

            trending_transaction_names_stats = {}
            trending_events = trends["data"]
            for t in trending_events:
                transaction_name = t["transaction"]
                project = t["project"]
                t_p_key = project + "," + transaction_name
                trending_transaction_names_stats[t_p_key] = response.data[t_p_key][trend_function]

            # send the results back to the client
            return Response(
                {
                    "events": self.handle_results_with_meta(
                        request,
                        organization,
                        params["project_id"],
                        {"data": trending_events, "meta": {"isMetricsData": True}},
                        True,
                    ),
                    "stats": trending_transaction_names_stats,
                    # temporary change to see what stats data is returned
                    "raw_stats": trends_request,
                },
                status=200,
            )
        # TODO check if this is applicable here
        except ValidationError:
            return Response({"detail": "Comparison period is outside retention window"}, status=400)
