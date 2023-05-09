from django.conf import settings
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from urllib3 import Retry

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.net.http import connection_from_url
from sentry.snuba import metrics_performance
from sentry.snuba.metrics_performance import query
from sentry.snuba.referrer import Referrer
from sentry.utils import json

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

        def get_event_stats_metrics(
            query_columns,
            user_query,
            params,
            rollup,
            zerofill_results,
            comparison_delta,
        ):
            # get top events
            # TODO handle empty request
            top_events = query(
                selected_columns,
                query=user_query,
                params=params,
                orderby=["-count()"],
                limit=100,
                referrer=Referrer.API_TRENDS_GET_EVENT_STATS_NEW.value,
                auto_aggregations=True,
                use_aggregate_conditions=True,
                auto_fields=True,
                allow_metric_aggregates=True,
            )

            top_transactions = [event.get("transaction") for event in top_events["data"]]
            query_with_transactions = " transaction:["
            for i, t in enumerate(top_transactions):
                query_with_transactions += f", {t}" if i > 0 else t
                if i == len(top_transactions) - 1:
                    query_with_transactions += "]"
            new_query = user_query + query_with_transactions

            # get their timeseries
            response = metrics_performance.timeseries_query(
                selected_columns=selected_columns,
                query=new_query,
                params=params,
                rollup=rollup,
                zerofill_results=zerofill_results,
                comparison_delta=None,
                allow_metric_aggregates=True,
                has_metrics=True,
                referrer=Referrer.API_TRENDS_GET_EVENT_STATS_NEW.value,
            )

            return response

        try:
            stats_data = self.get_event_stats_data(
                request,
                organization,
                get_event_stats_metrics,
                top_events=50,
                query_column=trend_function,
                params=params,
                query=_query,
                additional_query_column="count()",
            )

            # handle empty response
            if stats_data.get("data", None):
                return Response(
                    {
                        "events": self.handle_results_with_meta(
                            request, organization, params["project_id"], {"data": []}
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
                        request, organization, params["project_id"], {"data": trending_events}
                    ),
                    "stats": trending_transaction_names_stats,
                },
                status=200,
            )
        # TODO check if this is applicable here
        except ValidationError:
            return Response({"detail": "Comparison period is outside retention window"}, status=400)
