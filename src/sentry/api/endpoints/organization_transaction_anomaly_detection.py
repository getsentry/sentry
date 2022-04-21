from collections import namedtuple
from datetime import datetime, timedelta, timezone

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from urllib3 import Retry

from sentry import features
from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.api.utils import get_date_range_from_params
from sentry.net.http import connection_from_url
from sentry.snuba.discover import timeseries_query
from sentry.utils import json

ads_connection_pool = connection_from_url(
    settings.ANOMALY_DETECTION_URL,
    retries=Retry(
        total=5,
        status_forcelist=[408, 429, 502, 503, 504],
    ),
    timeout=settings.ANOMALY_DETECTION_TIMEOUT,
)

MappedParams = namedtuple("MappedParams", ["query_start", "query_end", "granularity"])


def get_anomalies(snuba_io):
    response = ads_connection_pool.urlopen(
        "POST",
        "/anomaly/predict",
        body=json.dumps(snuba_io),
        headers={"content-type": "application/json;charset=utf-8"},
    )
    return Response(json.loads(response.data), status=200)


def get_time_params(start, end):
    """
    Takes visualization start/end timestamps
    and returns the start/end/granularity
    of the snuba query that we should execute
    Attributes:
    start: datetime representing start of visualization window
    end: datetime representing end of visualization window
    Returns:
    results: namedtuple containing
        query_start: datetime representing start of query window
        query_end: datetime representing end of query window
        granularity: granularity to use (in seconds)
    """
    anomaly_detection_range = end - start

    if anomaly_detection_range > timedelta(days=14):
        snuba_range = timedelta(days=90)
        granularity = 3600

    elif anomaly_detection_range > timedelta(days=1):
        granularity = 1200
        snuba_range = timedelta(days=28)

    else:
        snuba_range = timedelta(days=14)
        granularity = 600

    additional_time_needed = snuba_range - anomaly_detection_range
    now = datetime.utcnow().astimezone(timezone.utc)
    start_limit = now - timedelta(days=90)
    end_limit = now
    start = max(start, start_limit)
    end = min(end, end_limit)
    # By default, expand windows equally in both directions
    window_increase = additional_time_needed / 2
    query_start, query_end = None, None

    # If window will go back farther than 90 days, use today - 90 as start
    if start - window_increase < start_limit:
        query_start = now - timedelta(days=90)
        additional_time_needed -= start - query_start
        window_increase = additional_time_needed
    # If window extends beyond today, use today as end
    if end + window_increase > end_limit:
        query_end = now
        additional_time_needed -= query_end - end
        window_increase = additional_time_needed

    query_start = query_start or max(start - window_increase, start_limit)
    query_end = query_end or min(end + window_increase, end_limit)

    return MappedParams(
        query_start,
        query_end,
        granularity,
    )


class OrganizationTransactionAnomalyDetectionEndpoint(OrganizationEventsEndpointBase):
    def has_feature(self, organization, request):
        return features.has(
            "organizations:performance-anomaly-detection-ui", organization, actor=request.user
        )

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        start, end = get_date_range_from_params(request.GET)
        time_params = get_time_params(start, end)
        query_params = self.get_snuba_params(request, organization)
        query = request.GET.get("query")
        query = f"{query} event.type:transaction" if query else "event.type:transaction"

        datetime_format = "%Y-%m-%d %H:%M:%S"
        ads_request = {
            "query": query,
            "params": query_params,
            "start": start.strftime(datetime_format),
            "end": end.strftime(datetime_format),
            "granularity": time_params.granularity,
        }

        # overwrite relevant time params
        query_params["start"] = time_params.query_start
        query_params["end"] = time_params.query_end

        with self.handle_query_errors():
            snuba_response = timeseries_query(
                selected_columns=["count()"],
                query=query,
                params=query_params,
                rollup=time_params.granularity,
                referrer="transaction-anomaly-detection",
                zerofill_results=False,
            )
            ads_request["data"] = snuba_response.data["data"]

            return get_anomalies(ads_request)
