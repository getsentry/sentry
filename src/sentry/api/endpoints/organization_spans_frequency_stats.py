from google.protobuf.json_format import MessageToDict
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_stats_pb2 import (
    AttributeDistributionsRequest,
    StatsType,
    TraceItemStatsRequest,
)
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry import features
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

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has(
            "organizations:performance-trace-explorer", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            # todo adjust this to be the right thing
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

        resolver = SearchResolver(
            params=snuba_params, config=SearchResolverConfig(), definitions=SPAN_DEFINITIONS
        )

        meta = resolver.resolve_meta(referrer=Referrer.API_SPANS_TAG_KEYS_RPC.value)

        # sample request from the tests in the sentry-protos repo
        # todo do we need this or it should be done in upstream?
        filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(
                    type=AttributeKey.TYPE_STRING,
                    name="eap.measurement",
                ),
                op=ComparisonFilter.OP_GREATER_THAN,
                value=AttributeValue(val_double=999),
            ),
        )
        stats_type = StatsType(
            attribute_distributions=AttributeDistributionsRequest(
                max_buckets=10, max_attributes=100
            )
        )

        rpc_request = TraceItemStatsRequest(
            filter=filter,
            meta=meta,
            stats_types=[stats_type],
        )
        # this part is mocked until the snuba changes are merged
        rpc_response = snuba_rpc.attribute_frequency_stats_rpc(rpc_request)

        # tod this part might change
        response_data = MessageToDict(rpc_response)

        return Response(response_data)
