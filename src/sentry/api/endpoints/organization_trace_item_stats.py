import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_trace_item_attributes import adjust_start_end_window
from sentry.api.event_search import translate_escape_sequences
from sentry.api.serializers.base import serialize
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.eap.constants import SUPPORTED_STATS_TYPES
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.attributes import (
    SPAN_ATTRIBUTE_DEFINITIONS,
    SPANS_STATS_EXCLUDED_ATTRIBUTES_PUBLIC_ALIAS,
)
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.cursors import Cursor, CursorResult

logger = logging.getLogger(__name__)


MAX_THREADS = 4


class TraceItemStatsPaginator:
    """
    Custom paginator for trace item stats that properly handles pagination
    based on the number of attributes fetched, not the number of stats types.
    Similar to TraceItemAttributesNamesPaginator, with some extra code to make
    it work for stats results/
    """

    def __init__(self, data_fn):
        self.data_fn = data_fn

    def get_result(self, limit, cursor=None):
        if limit <= 0:
            raise ValueError(f"invalid limit for paginator, expected >0, got {limit}")

        offset = cursor.offset if cursor is not None else 0
        # Request 1 more than limit so we can tell if there is another page
        data = self.data_fn(offset=offset, limit=limit + 1)
        has_more = data[1] >= limit + 1

        return CursorResult(
            data,
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )


class OrganizationTraceItemsStatsSerializer(serializers.Serializer):
    query = serializers.CharField(required=False)
    statsType = serializers.ListField(
        child=serializers.ChoiceField(list(SUPPORTED_STATS_TYPES)), required=True
    )
    substringMatch = serializers.CharField(
        required=False,
        help_text="Match substring on attribute name.",
    )
    limit = serializers.IntegerField(
        required=False,
    )
    spansLimit = serializers.IntegerField(required=False, default=1000, max_value=1000)


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

        substring_match = serialized.get("substringMatch", "")
        value_substring_match = translate_escape_sequences(substring_match)

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

        max_attributes = options.get("explore.trace-items.keys.max")

        def get_table_results():
            with handle_query_errors():
                return Spans.run_table_query(
                    params=snuba_params,
                    config=SearchResolverConfig(),
                    offset=0,
                    limit=serialized.get("spansLimit", 1000),
                    sampling_mode=snuba_params.sampling_mode,
                    query_string=serialized.get("query", ""),
                    orderby=["-timestamp"],
                    referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC.value,
                    selected_columns=["span_id", "timestamp"],
                )

        def run_stats_query_with_span_ids(span_id_filter):
            with handle_query_errors():
                return Spans.run_stats_query(
                    params=snuba_params,
                    stats_types=serialized.get("statsType"),
                    query_string=span_id_filter,
                    referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC.value,
                    config=resolver_config,
                    search_resolver=resolver,
                    max_buckets=1,
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

        def data_fn(offset: int, limit: int):
            table_results = get_table_results()
            if not table_results["data"]:
                return {"data": []}, 0

            span_ids = [row["span_id"] for row in table_results["data"]]
            span_id_list = ",".join(span_ids)

            preflight_stats = run_stats_query_with_span_ids(f"id:[{span_id_list}]")
            try:
                attr_keys = list(preflight_stats[0]["attribute_distributions"]["data"].keys())
            except (IndexError, KeyError):
                return {"data": []}, 0

            sanitized_keys = []
            for key in attr_keys:
                if key in SPANS_STATS_EXCLUDED_ATTRIBUTES_PUBLIC_ALIAS:
                    continue

                if value_substring_match:
                    if value_substring_match in key:
                        sanitized_keys.append(key)
                    continue

                sanitized_keys.append(key)

            sanitized_keys = sanitized_keys[offset : offset + limit]

            if not sanitized_keys:
                return {"data": []}, 0

            request_attrs_list = []
            for requested_key in sanitized_keys:
                if requested_key in SPAN_ATTRIBUTE_DEFINITIONS:
                    request_attrs_list.append(
                        AttributeKey(
                            name=SPAN_ATTRIBUTE_DEFINITIONS[requested_key].internal_name,
                            type=AttributeKey.TYPE_STRING,
                        )
                    )
                else:
                    request_attrs_list.append(
                        AttributeKey(name=requested_key, type=AttributeKey.TYPE_STRING)
                    )

            chunked_attributes: defaultdict[int, list[AttributeKey]] = defaultdict(list)
            for i, attr in enumerate(request_attrs_list):
                chunked_attributes[i % MAX_THREADS].append(
                    AttributeKey(name=attr.name, type=AttributeKey.TYPE_STRING)
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

            return {"data": [{k: v} for k, v in stats_results.items()]}, len(request_attrs_list)

        return self.paginate(
            request=request,
            paginator=TraceItemStatsPaginator(data_fn=data_fn),
            on_results=lambda results: serialize(results[0], request.user),
            default_per_page=serialized.get("limit") or max_attributes,
            max_per_page=max_attributes,
        )
