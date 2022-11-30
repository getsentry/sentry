from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.utils import get_date_range_from_stats_period
from sentry.ingest.transaction_clusterer.datasource import fetch_unique_transaction_names
from sentry.ingest.transaction_clusterer.tree import TreeClusterer


@region_silo_endpoint
class ProjectTransactionNamesCluster(ProjectEndpoint):
    private = True

    def get(self, request: Request, project) -> Response:
        """Run the transaction name clusterer and return its output.

        This endpoint is intended for internal evaluation of the clustering
        algorithm, not for public usage.
        """

        params = request.GET
        start, end = get_date_range_from_stats_period(params)
        if start is None or end is None:
            raise ParseError(detail="Invalid date range")

        snuba_limit = int(params.get("limit", 1000))
        merge_threshold = int(params.get("threshold", 100))
        return_all_names = params.get("returnAllNames")

        transaction_names = list(
            fetch_unique_transaction_names(
                project,
                (start, end),
                snuba_limit,
            )
        )

        clusterer = TreeClusterer(merge_threshold=merge_threshold)
        clusterer.add_input(transaction_names)

        return Response(
            {
                "rules": clusterer.get_rules(),
                "meta": {
                    "unique_transaction_names": transaction_names
                    if return_all_names
                    else len(transaction_names)
                },
            }
        )
