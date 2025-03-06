from google.protobuf.json_format import MessageToDict
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_stats_pb2 import (
    AttributeDistributionsRequest,
    StatsType,
    TraceItemStatsRequest,
)

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.models.organization import Organization
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.span_columns import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba_rpc


class OrganizationSpansFieldsStatsEndpointSerializer(serializers.Serializer):
    # Top number of frequencies to return for each attribute, defaults in snuba to 10 and can't be more than 100
    max_buckets = serializers.IntegerField(required=False, min_value=0, max_value=100, default=10)
    # Total number of attributes to return, defaults in snuba to 10_000
    max_attributes = serializers.IntegerField(required=False, min_value=0)


@region_silo_endpoint
class OrganizationSpansFieldsStatsEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.PERFORMANCE

    def get(self, request: Request, organization: Organization) -> Response:

        if not features.has(
            "organizations:performance-spans-fields-stats", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(
                {"attributeDistributions": []}  # Empty response matching the expected structure
            )

        serializer = OrganizationSpansFieldsStatsEndpointSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data
        # keep start and end as is
        snuba_params.start = snuba_params.start_date
        snuba_params.end = snuba_params.end_date

        resolver = SearchResolver(
            params=snuba_params, config=SearchResolverConfig(), definitions=SPAN_DEFINITIONS
        )

        meta = resolver.resolve_meta(referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC.value)
        query = request.GET.get("query")
        filter, _, _ = resolver.resolve_query(query)

        stats_type = StatsType(
            attribute_distributions=AttributeDistributionsRequest(
                max_buckets=serialized["max_buckets"],
                max_attributes=serialized.get("max_attributes"),
            )
        )

        rpc_request = TraceItemStatsRequest(
            filter=filter,
            meta=meta,
            stats_types=[stats_type],
        )

        rpc_response = snuba_rpc.trace_item_stats_rpc(rpc_request)

        response_data = MessageToDict(rpc_response)
        # Only return the results field from the response
        return Response({"results": response_data.get("results", [])})
