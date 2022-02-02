from datetime import datetime

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.api.utils import get_date_range_from_params
from sentry.search.events.builder import QueryBuilder
from sentry.snuba.dataset import Dataset


class OrganizationTransactionAnomalyDetectionEndpoint(OrganizationEventsEndpointBase):
    def get(self, request: Request, organization) -> Response:
        start, end = get_date_range_from_params(request.GET)
        query_start, query_end, granularity = self.map_snuba_queries(
            start.timestamp(), end.timestamp()
        )

        # remove unused and overwrite relevant time params
        for param in ["statsPeriod", "statsPeriodStart", "statsPeriodEnd"]:
            request.GET.pop(param, None)
        request.GET[start] = query_start
        request.GET[end] = query_end

        params = self.get_snuba_params(request, organization)
        query = request.GET.get("query")
        snql_query = self.get_snuba_query(params, query, granularity)

        return self.get_anomalies(snql_query)

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

    @staticmethod
    def get_snuba_query(params, query, granularity):
        query_builder = QueryBuilder(
            Dataset.Transactions,
            params,
            query=query,
            selected_columns=["count()"],
            orderby=["time"],
            limit=2200,  # max possible rows based on map_snuba_queries()
            turbo=False,
        )

        query = query_builder.get_snql_query()
        query.set_granularity(granularity)

        return query.snuba()

    @staticmethod
    def get_anomalies(snql_query):
        # call ADS
        return ""
