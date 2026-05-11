import logging
from collections import defaultdict
from concurrent.futures import as_completed
from dataclasses import dataclass
from typing import Literal, get_args

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.event_search import translate_escape_sequences
from sentry.api.serializers.base import serialize
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.eap.columns import ColumnDefinitions
from sentry.search.eap.constants import SUPPORTED_STATS_TYPES
from sentry.search.eap.occurrences.attributes import (
    OCCURRENCE_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    OCCURRENCE_STATS_EXCLUDED_ATTRIBUTES_PUBLIC_ALIAS,
)
from sentry.search.eap.occurrences.definitions import OCCURRENCE_DEFINITIONS
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.attributes import (
    SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
    SPANS_STATS_EXCLUDED_ATTRIBUTES_PUBLIC_ALIAS,
)
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba import rpc_dataset_common
from sentry.snuba.occurrences_rpc import Occurrences
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.cursors import Cursor, CursorResult

logger = logging.getLogger(__name__)


MAX_THREADS = 4

SupportedItemType = Literal["spans", "occurrences"]
SUPPORTED_ITEM_TYPES: tuple[SupportedItemType, ...] = get_args(SupportedItemType)


@dataclass(frozen=True)
class TraceItemStatsConfig:
    rpc_class: type[rpc_dataset_common.RPCBase]
    definitions: ColumnDefinitions
    alias_mappings: dict[Literal["string", "number", "boolean"], dict[str, str]]
    excluded_attributes: set[str]
    referrer: Referrer
    id_column: str


def get_trace_item_stats_config(item_type: SupportedItemType) -> TraceItemStatsConfig:
    if item_type == "occurrences":
        return TraceItemStatsConfig(
            rpc_class=Occurrences,
            definitions=OCCURRENCE_DEFINITIONS,
            alias_mappings=OCCURRENCE_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
            excluded_attributes=OCCURRENCE_STATS_EXCLUDED_ATTRIBUTES_PUBLIC_ALIAS,
            referrer=Referrer.API_OCCURRENCES_FREQUENCY_STATS_RPC,
            id_column="id",
        )
    return TraceItemStatsConfig(
        rpc_class=Spans,
        definitions=SPAN_DEFINITIONS,
        alias_mappings=SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
        excluded_attributes=SPANS_STATS_EXCLUDED_ATTRIBUTES_PUBLIC_ALIAS,
        referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC,
        id_column="span_id",
    )


class TraceItemStatsPaginator:
    """
    Custom paginator for trace item stats that properly handles pagination
    based on the number of attributes fetched, not the number of stats types.
    Similar to TraceItemAttributesNamesPaginator, with some extra code to make
    it work for stats results.
    """

    def __init__(self, data_fn):
        self.data_fn = data_fn

    def get_result(self, limit, cursor=None):
        if limit <= 0:
            raise ValueError(f"invalid limit for paginator, expected >0, got {limit}")

        offset = cursor.offset if cursor is not None else 0
        # Request 1 more than limit so we can tell if there is another page
        data = self.data_fn(offset=offset, limit=limit)
        has_more = data[1] >= offset + limit + 1

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
    traceItemsLimit = serializers.IntegerField(required=False, default=1000, max_value=1000)
    itemType = serializers.ChoiceField(
        choices=SUPPORTED_ITEM_TYPES,
        required=False,
        default="spans",
    )


@cell_silo_endpoint
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

        stats_config = get_trace_item_stats_config(serialized.get("itemType", "spans"))

        resolver_config = SearchResolverConfig()
        resolver = SearchResolver(
            params=snuba_params, config=resolver_config, definitions=stats_config.definitions
        )

        substring_match = serialized.get("substringMatch", "")
        value_substring_match = translate_escape_sequences(substring_match)

        max_attributes = options.get("explore.trace-items.keys.max")

        def get_table_results():
            with handle_query_errors():
                return stats_config.rpc_class.run_table_query(
                    params=snuba_params,
                    config=SearchResolverConfig(),
                    offset=0,
                    limit=serialized.get("traceItemsLimit", 1000),
                    sampling_mode=snuba_params.sampling_mode,
                    query_string=serialized.get("query", ""),
                    orderby=["-timestamp"],
                    referrer=stats_config.referrer.value,
                    selected_columns=[stats_config.id_column, "timestamp"],
                )

        def run_stats_query_with_item_ids(item_id_filter):
            with handle_query_errors():
                return stats_config.rpc_class.run_stats_query(
                    params=snuba_params,
                    stats_types=serialized.get("statsType"),
                    query_string=item_id_filter,
                    referrer=stats_config.referrer.value,
                    config=resolver_config,
                    search_resolver=resolver,
                    max_buckets=1,
                    skip_translate_internal_to_public_alias=True,
                )

        def run_stats_query_with_error_handling(attributes):
            with handle_query_errors():
                return stats_config.rpc_class.run_stats_query(
                    params=snuba_params,
                    stats_types=serialized.get("statsType"),
                    query_string=serialized.get("query", ""),
                    referrer=stats_config.referrer.value,
                    config=resolver_config,
                    search_resolver=resolver,
                    attributes=attributes,
                )

        def data_fn(offset: int, limit: int):
            table_results = get_table_results()
            if not table_results["data"]:
                return {"data": []}, 0

            item_ids = [row[stats_config.id_column] for row in table_results["data"]]
            item_id_list = ",".join(item_ids)

            preflight_stats = run_stats_query_with_item_ids(f"id:[{item_id_list}]")
            try:
                internal_alias_attr_keys = list(
                    preflight_stats[0]["attribute_distributions"]["data"].keys()
                )
            except (IndexError, KeyError):
                return {"data": []}, 0

            sanitized_keys = []
            for internal_name in internal_alias_attr_keys:
                public_alias = stats_config.alias_mappings.get("string", {}).get(
                    internal_name, internal_name
                )

                if public_alias in stats_config.excluded_attributes:
                    continue

                if value_substring_match:
                    if value_substring_match in public_alias:
                        sanitized_keys.append(internal_name)
                    continue

                sanitized_keys.append(internal_name)

            sanitized_keys = sanitized_keys[offset : offset + limit]

            if not sanitized_keys:
                return {"data": []}, 0

            request_attrs_list = []
            for requested_key in sanitized_keys:
                request_attrs_list.append(
                    AttributeKey(name=requested_key, type=AttributeKey.TYPE_STRING)
                )

            chunked_attributes: defaultdict[int, list[AttributeKey]] = defaultdict(list)
            for i, attr in enumerate(request_attrs_list):
                chunked_attributes[i % MAX_THREADS].append(
                    AttributeKey(name=attr.name, type=AttributeKey.TYPE_STRING)
                )

            stats_results: dict[str, dict[str, dict]] = defaultdict(lambda: {"data": {}})
            with ContextPropagatingThreadPoolExecutor(
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
