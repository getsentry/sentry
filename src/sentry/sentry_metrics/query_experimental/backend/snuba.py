from snuba_sdk import Entity
from snuba_sdk import Query as SnubaQuery
from snuba_sdk import Request as SnubaRequest

from sentry.sentry_metrics.query_experimental.types import SeriesQuery, SeriesResult
from sentry.utils.snuba import raw_snql_query

from .base import MetricsBackend


class SnubaMetricsBackend(MetricsBackend[SnubaRequest]):
    def generate_request(self, query: SeriesQuery) -> SnubaRequest:
        """
        Generate a SnQL query from a metric series query.
        """

        # TODO: Ensure this is can be compiled into a single query!

        snuba_query = SnubaQuery(
            match=Entity("metrics"),  # TODO: resolve entity
            select=None,  # TODO
            groupby=None,  # TODO
            where=None,  # TODO
            granularity=None,  # TODO
        )

        return SnubaRequest(
            dataset="metrics",  # TODO: resolve dataset
            app_id="default",
            query=snuba_query,
            tenant_ids={"organization_id": -1},  # TODO
        )

    def run_query(self, query: SeriesQuery) -> SeriesResult:
        request = self.generate_request(query)
        snuba_results = raw_snql_query(request, use_cache=False, referrer="sentry_metrics.query")
        assert snuba_results, "silence flake8"
        # TODO: Get necessary subset of SnubaResultConverter
        raise NotImplementedError()
