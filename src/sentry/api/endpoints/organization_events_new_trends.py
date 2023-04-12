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
        "/trends/breakpoint_detector",
        body=json.dumps(snuba_io),
        headers={"content-type": "application/json;charset=utf-8"},
    )
    return Response(json.loads(response.data), status=200)


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
        # TODO use user query and remove trends-specific aliases
        _query = (
            "tpm():>0.01 transaction.duration:>0 transaction.duration:<15min event.type:transaction"
        )

        request.yAxis = selected_columns.append(trend_function)

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
                limit=10,
                organization=organization,
                referrer=Referrer.API_TRENDS_GET_EVENT_STATS_NEW.value,
                allow_empty=False,
                zerofill_results=zerofill_results,
                orderby=["count()"],
            )

            return results

        try:
            response = Response(
                self.get_event_stats_data(
                    request,
                    organization,
                    get_event_stats,
                    top_events=10,
                    query_column=trend_function,
                    params=params,
                    query=_query,
                )
            )

            trends_request = {"data": None}
            data = response.data

            data["sort"] = request.GET.get("sort", "trend_percentage()")
            data["trendFunction"] = trend_function
            trends_request["data"] = data

            # send the data to microservice
            trends = get_trends(trends_request)

            # send the results back to the client
            return trends
        # TODO check if this is applicable here
        except ValidationError:
            return Response({"detail": "Comparison period is outside retention window"}, status=400)
