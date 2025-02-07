from google.protobuf.json_format import MessageToDict
from rest_framework.exceptions import ParseError
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
from sentry.api.endpoints.organization_spans_fields import OrganizationSpansFieldsEndpointSerializer
from sentry.models.organization import Organization
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.span_columns import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba_rpc


@region_silo_endpoint
class OrganizationSpansFrequencyStatsEndpoint(OrganizationEventsV2EndpointBase):
    snuba_methods = ["GET"]
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.PERFORMANCE

    def get(self, request: Request, organization: Organization) -> Response:

        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(
                {"attributeDistributions": []}  # Empty response matching the expected structure
            )

        serializer = OrganizationSpansFieldsEndpointSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        # this endpoint is only supported for spans for this project
        if serialized["dataset"] != "spans":
            raise ParseError(detail='only using dataset="spans" is supported for this endpoint')

        # keep start and end as is
        snuba_params.start = snuba_params.start_date
        snuba_params.end = snuba_params.end_date

        # if values are not provided, we will use zeros and then snuba RPC will set the defaults
        # Top number of frequencies to return for each attribute, defaults in snuba to 10 and can't be more than 100
        max_buckets = request.GET.get("maxBuckets", 0)
        # Total number of attributes to return, defaults in snuba to 10_000
        max_attributes = request.GET.get("maxAttributes", 0)
        try:
            max_buckets = int(max_buckets)
            max_attributes = int(max_attributes)
        except ValueError:
            raise ParseError(detail="maxBuckets and maxAttributes must be integers")

        # max_buckets is limited to 100 by snuba
        if max_buckets > 100:
            raise ParseError(detail="maxBuckets max value is 100")

        resolver = SearchResolver(
            params=snuba_params, config=SearchResolverConfig(), definitions=SPAN_DEFINITIONS
        )

        meta = resolver.resolve_meta(referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC.value)
        query = request.GET.get("query")
        filter, _, _ = resolver.resolve_query(query)

        stats_type = StatsType(
            attribute_distributions=AttributeDistributionsRequest(
                max_buckets=max_buckets, max_attributes=max_attributes
            )
        )

        rpc_request = TraceItemStatsRequest(
            filter=filter,
            meta=meta,
            stats_types=[stats_type],
        )

        rpc_response = snuba_rpc.attribute_frequency_stats_rpc(rpc_request)

        response_data = MessageToDict(rpc_response)

        return Response(response_data)
