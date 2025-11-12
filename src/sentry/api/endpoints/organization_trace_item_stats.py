import logging
from concurrent.futures import ThreadPoolExecutor

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

logger = logging.getLogger(__name__)

SUPPORTED_STATS_TYPES = ["attributeDistributions", "totals"]


@region_silo_endpoint
class OrganizationTraceItemsStatsEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.VISIBILITY

    def get(self, request: Request, organization: Organization) -> Response:
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"data": []})

        stats_types = set(request.GET.getlist("statsType", default=["attributeDistributions"]))
        for stats_type in stats_types:
            if stats_type not in SUPPORTED_STATS_TYPES:
                raise InvalidSearchQuery(
                    f"{stats_type} is not a valid stats_type. Please use one of the allowed stats types: {SUPPORTED_STATS_TYPES}."
                )

        resolver_config = SearchResolverConfig()
        resolver = SearchResolver(
            params=snuba_params, config=resolver_config, definitions=SPAN_DEFINITIONS
        )

        query = request.GET.get("query", "")

        with ThreadPoolExecutor(
            thread_name_prefix=__name__,
            max_workers=4,
        ) as query_thread_pool:
            futures_store = {}
            if "totals" in stats_types:
                totals_future = query_thread_pool.submit(
                    Spans.run_table_query,
                    params=snuba_params,
                    query_string=query,
                    selected_columns=["count(span.duration)"],
                    orderby=None,
                    config=resolver_config,
                    offset=0,
                    limit=1,
                    sampling_mode=snuba_params.sampling_mode,
                    referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC.value,
                )
                futures_store["totals"] = totals_future

            if stats_types - {"totals"}:
                stats_future = query_thread_pool.submit(
                    Spans.run_stats_query,
                    params=snuba_params,
                    stats_types=stats_types,
                    query_string=query,
                    referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC.value,
                    config=resolver_config,
                    search_resolver=resolver,
                )
                futures_store["stats"] = stats_future

        results = []

        if "totals" in futures_store:
            totals_f = futures_store["totals"]
            totals_result = totals_f.result()
            results.append({"totals": totals_result})

        if "stats" in futures_store:
            stats_f = futures_store["stats"]
            stats_results = stats_f.result()
            results.extend(stats_results)

        return Response({"data": results})
