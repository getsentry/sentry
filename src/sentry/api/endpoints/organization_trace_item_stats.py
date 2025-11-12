import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.search.eap.constants import SUPPORTED_STATS_TYPES
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

logger = logging.getLogger(__name__)


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
        if not stats_types:
            raise InvalidSearchQuery(
                f"Please specify `statsType`. Supported stats types are: {SUPPORTED_STATS_TYPES}."
            )

        for stats_type in stats_types:
            if stats_type not in SUPPORTED_STATS_TYPES:
                raise InvalidSearchQuery(
                    f"{stats_type} is not a valid statsType. Please use one of the allowed stats types: {SUPPORTED_STATS_TYPES}."
                )

        resolver_config = SearchResolverConfig()
        resolver = SearchResolver(
            params=snuba_params, config=resolver_config, definitions=SPAN_DEFINITIONS
        )

        query = request.GET.get("query", "")
        stats_results = Spans.run_stats_query(
            params=snuba_params,
            stats_types=stats_types,
            query_string=query,
            referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC.value,
            config=resolver_config,
            search_resolver=resolver,
        )

        return Response({"data": stats_results})
