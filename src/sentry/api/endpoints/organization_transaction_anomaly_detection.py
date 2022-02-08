from datetime import datetime

from django.conf import settings
from rest_framework.request import Request
from rest_framework.response import Response
from urllib3 import Retry, connection_from_url

from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.api.utils import get_date_range_from_params
from sentry.snuba.discover import timeseries_query
from sentry.utils import json


def get_anomalies(snuba_io):
    ads_connection_pool = connection_from_url(
        settings.ANOMALY_DETECTION_URL,
        retries=Retry(
            total=5,
            status_forcelist=[408, 429, 502, 503, 504],
        ),
        timeout=settings.SENTRY_SNUBA_TIMEOUT,
    )

    return ads_connection_pool.urlopen(
        "POST",
        "/anomaly/predict",
        body=json.dumps(snuba_io),
        headers={"content-type": "application/json;charset=utf-8"},
    )


class OrganizationTransactionAnomalyDetectionEndpoint(OrganizationEventsEndpointBase):
    def get(self, request: Request, organization) -> Response:
        start, end = get_date_range_from_params(request.GET)
        query_start, query_end, granularity = self.map_snuba_queries(
            start.timestamp(), end.timestamp()
        )
        params = self.get_snuba_params(request, organization)
        query = request.GET.get("query")
        query = f"{query} event.type:transaction" if query else "event.type:transaction"

        # overwrite relevant time params
        params["statsPeriodStart"] = query_start
        params["statsPeriodEnd"] = query_end

        snuba_response = timeseries_query(
            selected_columns=["count()"],
            query=query,
            params=params,
            rollup=granularity,
            referrer="transaction-anomaly-detection",
            zerofill_results=False,
        )

        return get_anomalies(
            {
                "data": snuba_response.data["data"],
                "query": query,
                "params": params,
                "granularity": granularity,
            }
        )

    @staticmethod
    def map_snuba_queries(start, end):
        """
        Takes visualization start/end timestamps
        and returns the start/end/granularity
        of the snuba query that we should execute

        Attributes:
        start: unix timestamp representing start of visualization window
        end: unix timestamp representing end of visualization window

        Returns:
        results: tuple containing
            query_start: datetime representing start of query window
            query_end: datetime representing end of query window
            granularity: granularity to use (in seconds)
        """

        def days(n):
            return 60 * 60 * 24 * n

        if end - start <= days(2):
            granularity = 300
            query_start = end - days(7)
        elif end - start <= days(7):
            granularity = 600
            query_start = end - days(14)
        elif end - start <= days(14):
            granularity = 1200
            query_start = end - days(28)
        else:
            granularity = 3600
            query_start = end - days(90)
        query_end = end

        return (
            datetime.fromtimestamp(query_start),
            datetime.fromtimestamp(query_end),
            granularity,
        )
