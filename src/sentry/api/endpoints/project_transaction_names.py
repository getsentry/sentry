from itertools import islice

from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.utils import get_date_range_from_stats_period
from sentry.ingest.transaction_clusterer import ClustererNamespace
from sentry.ingest.transaction_clusterer import rules as rule_store
from sentry.ingest.transaction_clusterer.datasource import redis, snuba
from sentry.ingest.transaction_clusterer.tree import TreeClusterer


@region_silo_endpoint
class ProjectTransactionNamesCluster(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project) -> Response:
        """Run the transaction name clusterer and return its output.

        This endpoint is intended for internal evaluation of the clustering
        algorithm, not for public usage.
        """

        params = request.GET
        start, end = get_date_range_from_stats_period(params)
        if start is None or end is None:
            raise ParseError(detail="Invalid date range")

        datasource = params.get("datasource", "snuba")
        limit = int(params.get("limit", 1000))
        merge_threshold = int(params.get("threshold", 100))
        return_all_names = params.get("returnAllNames")
        namespace = params.get("namespace")

        if namespace == "spans":
            namespace = ClustererNamespace.SPANS
            data = redis.get_span_descriptions(project)
        else:
            namespace = ClustererNamespace.TRANSACTIONS
            if datasource == "redis":
                # NOTE: redis ignores the time range parameters
                data = islice(redis.get_transaction_names(project), limit)
            else:
                data = snuba.fetch_unique_transaction_names(
                    project,
                    (start, end),
                    limit,
                )

        data = list(data)

        clusterer = TreeClusterer(merge_threshold=merge_threshold)
        clusterer.add_input(data)

        return Response(
            {
                "rules": clusterer.get_rules(),
                "meta": {
                    "unique_transaction_names": data if return_all_names else len(data),
                    "rules_redis": rule_store.get_redis_rules(namespace, project),
                    "rules_projectoption": rule_store.get_rules(namespace, project),
                },
            }
        )
