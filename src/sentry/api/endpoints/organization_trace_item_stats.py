import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import TraceItemAttributeNamesRequest
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_trace_item_attributes import adjust_start_end_window
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.eap.constants import SUPPORTED_STATS_TYPES
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.attributes import SPANS_STATS_EXCLUDED_ATTRIBUTES
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils import snuba_rpc

logger = logging.getLogger(__name__)


MAX_THREADS = 4


class OrganizationTraceItemsStatsSerializer(serializers.Serializer):
    query = serializers.CharField(required=False)
    statsType = serializers.ListField(
        child=serializers.ChoiceField(list(SUPPORTED_STATS_TYPES)), required=True
    )


@region_silo_endpoint
class OrganizationTraceItemsStatsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING

    def get(self, request: Request, organization: Organization) -> Response:
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"data": []})

        serializer = OrganizationTraceItemsStatsSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serialized = serializer.validated_data

        resolver_config = SearchResolverConfig()
        resolver = SearchResolver(
            params=snuba_params, config=resolver_config, definitions=SPAN_DEFINITIONS
        )

        query_string = serialized.get("query")
        query_filter, _, _ = resolver.resolve_query(query_string)

        # Fetch attribute names
        adjusted_start_date, adjusted_end_date = adjust_start_end_window(
            snuba_params.start_date, snuba_params.end_date
        )
        attrs_snuba_params = snuba_params.copy()
        attrs_snuba_params.start = adjusted_start_date
        attrs_snuba_params.end = adjusted_end_date
        attrs_resolver = SearchResolver(
            params=attrs_snuba_params, config=resolver_config, definitions=SPAN_DEFINITIONS
        )
        attrs_meta = attrs_resolver.resolve_meta(
            referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC.value
        )
        attrs_meta.trace_item_type = TraceItemType.TRACE_ITEM_TYPE_SPAN

        attr_type = AttributeKey.Type.TYPE_STRING
        max_attributes = options.get("explore.trace-items.keys.max")

        with handle_query_errors():
            attrs_request = TraceItemAttributeNamesRequest(
                meta=attrs_meta,
                limit=max_attributes,
                type=attr_type,
                intersecting_attributes_filter=query_filter,
            )

            attrs_response = snuba_rpc.attribute_names_rpc(attrs_request)

        # Chunk attributes and run stats query in parallel
        chunked_attributes: defaultdict[int, list[AttributeKey]] = defaultdict(list)
        for i, attr in enumerate(attrs_response.attributes):
            if attr.name in SPANS_STATS_EXCLUDED_ATTRIBUTES:
                continue

            chunked_attributes[i % MAX_THREADS].append(
                AttributeKey(name=attr.name, type=AttributeKey.TYPE_STRING)
            )

        def run_stats_query_with_error_handling(attributes):
            with handle_query_errors():
                return Spans.run_stats_query(
                    params=snuba_params,
                    stats_types=serialized.get("statsType"),
                    query_string=serialized.get("query", ""),
                    referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC.value,
                    config=resolver_config,
                    search_resolver=resolver,
                    attributes=attributes,
                )

        stats_results: dict[str, dict[str, dict]] = defaultdict(lambda: {"data": {}})
        with ThreadPoolExecutor(
            thread_name_prefix=__name__,
            max_workers=MAX_THREADS,
        ) as query_thread_pool:

            futures = [
                query_thread_pool.submit(run_stats_query_with_error_handling, attributes)
                for attributes in chunked_attributes.values()
            ]

            for future in as_completed(futures):
                result = future.result()
                for stats in result:
                    for stats_type, data in stats.items():
                        stats_results[stats_type]["data"].update(data["data"])

        return Response({"data": [{k: v} for k, v in stats_results.items()]})
