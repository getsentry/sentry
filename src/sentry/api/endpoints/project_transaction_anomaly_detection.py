from datetime import datetime

from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Limit,
    Offset,
    Op,
    OrderBy,
    Query,
)

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.utils import get_date_range_from_params
from sentry.utils.snuba import _snuba_pool


class ProjectTransactionAnomalyDetectionEndpoint(ProjectEndpoint):
    def get(self, request: Request) -> Response:
        transaction = request.GET.get("transaction")
        project_id = request.GET.get("project")
        dataset = "transactions"
        start, end = get_date_range_from_params(request.GET)
        query_start, query_end, granularity = self.map_snuba_queries(
            start.timestamp(), end.timestamp()
        )

        query = self.get_snuba_query(
            dataset, query_start, query_end, granularity, project_id, transaction
        )
        snuba_transaction_data = self.submit_snuba_query(query)
        return self.get_anomalies(snuba_transaction_data)

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
    def get_snuba_query(dataset, query_start, query_end, granularity, project_id, transaction):
        """
        dataset: dataset name
        query_start: starting datetime
        query_end: ending datetime
        granularity: data granularity in seconds
        project_id: project_id
        transaction: transaction name
        """
        query = Query(
            dataset=dataset,
            match=Entity("transactions"),
            select=[Function("count", [], "transaction_count")],
            groupby=[Column("time")],
            where=[
                Condition(Column("finish_ts"), Op.GTE, query_start),
                Condition(Column("finish_ts"), Op.LT, query_end),
                Condition(Column("project_id"), Op.EQ, project_id),
                Condition(Column("transaction"), Op.EQ, transaction),
            ],
            orderby=[OrderBy(Column("time"), Direction.ASC)],
            offset=Offset(0),
            limit=Limit(2200),  # max possible rows based on map_snuba_queries()
            granularity=Granularity(granularity),
        )

        query.set_parent_api("<unknown>").set_turbo(False).set_consistent(False).set_debug(
            False
        ).set_dry_run(False).set_legacy(False)

        return query

    @staticmethod
    def submit_snuba_query(query):
        response = _snuba_pool.urlopen(
            "POST",
            f"/{query.dataset}/snql",
            body=query.snuba(),
            headers={"referer": "transaction-anomaly-detection-endpoint"},
        )

        return response.json()

    @staticmethod
    def get_anomalies(transaction_data):
        # call ADS
        return ""
