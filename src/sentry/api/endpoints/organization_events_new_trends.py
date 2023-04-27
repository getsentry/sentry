from datetime import datetime
from typing import Optional

from django.conf import settings
from rest_framework.exceptions import ParseError, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from urllib3 import Retry

from sentry import features
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.net.http import connection_from_url
from sentry.snuba import discover
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

        # TODO get 2 weeks before and a week after if possible

        trend_type = request.GET.get("trendType", REGRESSION)
        if trend_type not in TREND_TYPES:
            raise ParseError(detail=f"{trend_type} is not a supported trend type")

        trend_function = request.GET.get("trendFunction", "p50()")

        selected_columns = self.get_field_list(organization, request)

        top_columns = ["count()", "transaction", "project"]
        query = request.GET.get("query")

        selected_columns.append(trend_function)
        selected_columns.append("count()")
        request.yAxis = selected_columns

        def get_event_stats(
            query_columns,
            query,
            params,
            rollup: int,
            zerofill_results: bool,
            comparison_delta: Optional[datetime],
        ):
            results = discover.top_events_timeseries(
                timeseries_columns=query_columns,
                selected_columns=top_columns,
                user_query=query,
                params=params,
                rollup=rollup,
                # high limit is set to validate the regression analysis
                limit=2,
                organization=organization,
                referrer=Referrer.API_TRENDS_GET_EVENT_STATS_NEW.value,
                allow_empty=False,
                zerofill_results=zerofill_results,
                orderby=["-count()"],
            )

            return results

        try:
            stats_data = self.get_event_stats_data(
                request,
                organization,
                get_event_stats,
                top_events=2,
                query_column=trend_function,
                params=params,
                query=query,
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
                trending_transaction_names_stats[t_p_key] = response.data[t_p_key]

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
