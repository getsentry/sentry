import dataclasses
import logging
from collections import defaultdict
from collections.abc import Callable, Sequence
from concurrent.futures import as_completed
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Literal, cast, get_args

from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_trace_item_stats_types import TraceItemStatsResponse
from sentry.api.event_search import (
    AggregateFilter,
    ParenExpression,
    QueryToken,
    translate_escape_sequences,
)
from sentry.api.serializers.base import serialize
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.trace_item_stats_examples import TraceItemStatsExamples
from sentry.apidocs.omissions import sentry_schema_serializer
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, OrganizationParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.staff import is_active_staff
from sentry.auth.superuser import is_active_superuser
from sentry.exceptions import InvalidSearchQuery
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
from sentry.search.eap.types import EAPResponse, SearchResolverConfig, SupportedTraceItemType
from sentry.search.eap.utils import can_expose_attribute_to_api, get_stats_chunk_count
from sentry.search.events.types import SnubaParams
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
    visibility_item_type: SupportedTraceItemType


def get_trace_item_stats_config(item_type: SupportedItemType) -> TraceItemStatsConfig:
    if item_type == "occurrences":
        return TraceItemStatsConfig(
            rpc_class=Occurrences,
            definitions=OCCURRENCE_DEFINITIONS,
            alias_mappings=OCCURRENCE_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
            excluded_attributes=OCCURRENCE_STATS_EXCLUDED_ATTRIBUTES_PUBLIC_ALIAS,
            referrer=Referrer.API_OCCURRENCES_FREQUENCY_STATS_RPC,
            id_column="id",
            visibility_item_type=SupportedTraceItemType.OCCURRENCES,
        )
    return TraceItemStatsConfig(
        rpc_class=Spans,
        definitions=SPAN_DEFINITIONS,
        alias_mappings=SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS,
        excluded_attributes=SPANS_STATS_EXCLUDED_ATTRIBUTES_PUBLIC_ALIAS,
        referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC,
        id_column="span_id",
        visibility_item_type=SupportedTraceItemType.SPANS,
    )


def _find_aggregate_filters(terms: Sequence[QueryToken]) -> list[AggregateFilter]:
    found: list[AggregateFilter] = []
    for term in terms:
        if isinstance(term, AggregateFilter):
            found.append(term)
        elif isinstance(term, ParenExpression):
            found.extend(_find_aggregate_filters(term.children))
    return found


class TraceItemStatsPaginator:
    """
    Custom paginator for trace item stats that properly handles pagination
    based on the number of attributes fetched, not the number of stats types.
    Similar to TraceItemAttributesNamesPaginator, with some extra code to make
    it work for stats results.
    """

    def __init__(self, data_fn: Callable[..., tuple[dict[str, Any], int]]) -> None:
        self.data_fn = data_fn

    def get_result(self, limit: int, cursor: Cursor | None = None) -> CursorResult[dict[str, Any]]:
        if limit <= 0:
            raise ValueError(f"invalid limit for paginator, expected >0, got {limit}")

        offset = cursor.offset if cursor is not None else 0
        # data_fn returns (payload, total_count), where total_count is the number of
        # attributes available across all pages. There is a next page whenever the total
        # extends at least one attribute past the end of the current page (offset + limit).
        data = self.data_fn(offset=offset, limit=limit)
        has_more = data[1] >= offset + limit + 1

        return CursorResult(
            cast("Sequence[dict[str, Any]]", data),
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, has_more),
        )


@sentry_schema_serializer(
    omit_from_public_schema={
        "limit": (
            "The page size the Explore UI requests. It raises the page-size cap instead of "
            "being bounded by it."
        ),
    }
)
class OrganizationTraceItemStatsSerializer(serializers.Serializer):
    query = serializers.CharField(
        required=False,
        help_text="Sentry [search syntax](https://docs.sentry.io/concepts/search/) to filter trace items before computing statistics.",
    )
    statsType = serializers.ListField(
        child=serializers.ChoiceField(sorted(SUPPORTED_STATS_TYPES)),
        required=True,
        help_text="The statistics to compute over the matching trace items.",
    )
    substringMatch = serializers.CharField(
        required=False,
        help_text="Restrict results to attribute names containing this substring (case-sensitive).",
    )
    # TODO: Bound `limit` with an appropriate cap. Passed as `default_per_page`, it lifts the
    # `explore.trace-items.keys.max` page-size cap, so any client can request an unbounded page.
    limit = serializers.IntegerField(
        required=False,
    )
    traceItemsLimit = serializers.IntegerField(
        required=False,
        default=1000,
        max_value=1000,
        help_text="Maximum number of trace items to sample when computing statistics. Defaults to `1000`, which is also the maximum.",
    )
    itemType = serializers.ChoiceField(
        choices=SUPPORTED_ITEM_TYPES,
        required=False,
        default="spans",
        help_text="The trace item dataset to compute statistics for. Defaults to `spans`.",
    )


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationTraceItemStatsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.DATA_BROWSING

    @extend_schema(
        operation_id="Retrieve Trace Item Statistics",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            OrganizationTraceItemStatsSerializer,
            CursorQueryParam,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "TraceItemStatsResponse", TraceItemStatsResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=TraceItemStatsExamples.TRACE_ITEM_STATS,
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[TraceItemStatsResponse] | Response[ValidationErrorResponse]:
        """
        Compute statistics, such as attribute value distributions, over the trace
        items (spans or occurrences) matching the given query within the requested
        time range.
        """
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"data": []})

        serializer = OrganizationTraceItemStatsSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)
        serialized = serializer.validated_data

        stats_config = get_trace_item_stats_config(serialized.get("itemType", "spans"))

        resolver_config = SearchResolverConfig()
        resolver = SearchResolver(
            params=snuba_params, config=resolver_config, definitions=stats_config.definitions
        )

        # Stats are computed over individual trace items, so an aggregate filter has no
        # group to apply to and Snuba rejects the query. Only parse here: a full resolve
        # is expensive and the RPCs below resolve the query again.
        with handle_query_errors():
            aggregate_filters = _find_aggregate_filters(
                resolver.parse_search_query(serialized.get("query", ""))
            )
            if aggregate_filters:
                names = ", ".join(f.key.name for f in aggregate_filters)
                raise InvalidSearchQuery(
                    f"Aggregate filters are not supported for trace item stats: {names}"
                )

        substring_match = serialized.get("substringMatch", "")
        value_substring_match = translate_escape_sequences(substring_match)

        max_attributes = options.get("explore.trace-items.keys.max")
        include_internal = is_active_superuser(request) or is_active_staff(request)
        include_internal_convention_attributes = request.user.is_staff or request.user.is_superuser

        def get_table_results() -> EAPResponse:
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

        def get_preflight_params(rows: list[dict[str, Any]]) -> SnubaParams:
            # Filtering on item ids alone can't prune granules, so bound the
            # preflight to the time span of the sampled items. Snuba compares
            # whole seconds with an exclusive end, hence the floor and +1s.
            timestamps = [datetime.fromisoformat(row["timestamp"]) for row in rows]
            start = min(timestamps).replace(microsecond=0)
            end = max(timestamps).replace(microsecond=0) + timedelta(seconds=1)
            return dataclasses.replace(
                snuba_params,
                start=max(start, snuba_params.start_date),
                end=min(end, snuba_params.end_date),
            )

        def run_stats_query_with_item_ids(
            item_id_filter: str,
            params: SnubaParams,
        ) -> list[dict[str, Any]]:
            with handle_query_errors():
                return stats_config.rpc_class.run_stats_query(
                    params=params,
                    stats_types=serialized.get("statsType"),
                    query_string=item_id_filter,
                    referrer=stats_config.referrer.value,
                    config=resolver_config,
                    search_resolver=SearchResolver(
                        params=params,
                        config=resolver_config,
                        definitions=stats_config.definitions,
                    ),
                    max_buckets=1,
                    skip_translate_internal_to_public_alias=True,
                )

        def run_stats_query_with_error_handling(
            attributes: list[AttributeKey],
        ) -> list[dict[str, dict[str, dict[str, Any]]]]:
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

        def data_fn(offset: int, limit: int) -> tuple[dict[str, Any], int]:
            table_results = get_table_results()
            if not table_results["data"]:
                return {"data": []}, 0

            item_ids = [row[stats_config.id_column] for row in table_results["data"]]
            item_id_list = ",".join(item_ids)

            preflight_stats = run_stats_query_with_item_ids(
                f"id:[{item_id_list}]", get_preflight_params(table_results["data"])
            )
            try:
                internal_alias_attr_keys = list(
                    preflight_stats[0]["attributeDistributions"]["data"].keys()
                )
            except (IndexError, KeyError):
                return {"data": []}, 0

            sanitized_keys = []
            visited_public_keys = []
            for internal_name in internal_alias_attr_keys:
                public_alias = stats_config.alias_mappings.get("string", {}).get(
                    internal_name, internal_name
                )

                if (
                    public_alias in stats_config.excluded_attributes
                    or public_alias in visited_public_keys
                ):
                    continue

                if not can_expose_attribute_to_api(
                    public_alias,
                    stats_config.visibility_item_type,
                    include_internal=include_internal,
                    include_internal_convention_attributes=include_internal_convention_attributes,
                ):
                    continue

                if value_substring_match:
                    if value_substring_match in public_alias:
                        visited_public_keys.append(public_alias)
                        sanitized_keys.append(internal_name)
                    continue

                visited_public_keys.append(public_alias)
                sanitized_keys.append(internal_name)

            # The number of attributes available across all pages drives pagination
            # (see TraceItemStatsPaginator), so capture the total before slicing.
            total_attributes = len(sanitized_keys)
            paginated_keys = sanitized_keys[offset : offset + limit]

            if not paginated_keys:
                return {"data": []}, total_attributes

            request_attrs_list = []
            for requested_key in paginated_keys:
                request_attrs_list.append(
                    AttributeKey(name=requested_key, type=AttributeKey.TYPE_STRING)
                )

            chunk_count = get_stats_chunk_count(len(request_attrs_list), MAX_THREADS)
            chunked_attributes: defaultdict[int, list[AttributeKey]] = defaultdict(list)
            for i, attr in enumerate(request_attrs_list):
                chunked_attributes[i % chunk_count].append(
                    AttributeKey(name=attr.name, type=AttributeKey.TYPE_STRING)
                )

            stats_results: dict[str, dict[str, dict[str, Any]]] = defaultdict(lambda: {"data": {}})
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

            return {"data": [{k: v} for k, v in stats_results.items()]}, total_attributes

        return self.paginate(
            request=request,
            paginator=TraceItemStatsPaginator(data_fn=data_fn),
            on_results=lambda results: serialize(results[0], request.user),
            default_per_page=serialized.get("limit") or max_attributes,
            max_per_page=max_attributes,
        )
