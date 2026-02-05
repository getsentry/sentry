import logging
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import sentry_sdk
from google.protobuf.json_format import MessageToJson
from sentry_protos.snuba.v1.endpoint_get_trace_pb2 import GetTraceRequest
from sentry_protos.snuba.v1.endpoint_trace_item_stats_pb2 import (
    AttributeDistributionsRequest,
    StatsType,
    TraceItemStatsRequest,
)
from sentry_protos.snuba.v1.request_common_pb2 import PageToken, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry import options
from sentry.models.project import Project
from sentry.search.eap.constants import BOOLEAN, DOUBLE, INT, STRING, SUPPORTED_STATS_TYPES
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import (
    AdditionalQueries,
    EAPResponse,
    SearchResolverConfig,
    SupportedTraceItemType,
)
from sentry.search.eap.utils import can_expose_attribute, translate_internal_to_public_alias
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.snuba import rpc_dataset_common
from sentry.utils import json, snuba_rpc

logger = logging.getLogger("sentry.snuba.spans_rpc")


class Spans(rpc_dataset_common.RPCBase):
    DEFINITIONS = SPAN_DEFINITIONS

    @classmethod
    def filter_project(cls, project: Project) -> bool:
        return project.flags.has_transactions

    @classmethod
    @sentry_sdk.trace
    def run_table_query(
        cls,
        *,
        params: SnubaParams,
        query_string: str,
        selected_columns: list[str],
        orderby: list[str] | None,
        offset: int,
        limit: int,
        referrer: str,
        config: SearchResolverConfig,
        sampling_mode: SAMPLING_MODES | None = None,
        equations: list[str] | None = None,
        search_resolver: SearchResolver | None = None,
        page_token: PageToken | None = None,
        additional_queries: AdditionalQueries | None = None,
    ) -> EAPResponse:
        return cls._run_table_query(
            rpc_dataset_common.TableQuery(
                query_string=query_string,
                selected_columns=selected_columns,
                equations=equations,
                orderby=orderby,
                offset=offset,
                limit=limit,
                referrer=referrer,
                sampling_mode=sampling_mode,
                page_token=page_token,
                resolver=search_resolver or cls.get_resolver(params, config),
                additional_queries=additional_queries,
            ),
            params.debug,
        )

    @classmethod
    @sentry_sdk.trace
    def run_trace_query(
        cls,
        *,
        trace_id: str,
        params: SnubaParams,
        referrer: str,
        config: SearchResolverConfig,
        additional_attributes: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        if additional_attributes is None:
            additional_attributes = []

        trace_attributes = [
            "parent_span",
            "description",
            "span.op",
            "span.name",
            "is_transaction",
            "transaction.span_id",
            "transaction.event_id",
            "transaction",
            "precise.start_ts",
            "precise.finish_ts",
            "project.id",
            "profile.id",
            "profiler.id",
            "span.duration",
            "sdk.name",
            "measurements.time_to_initial_display",
            "measurements.time_to_full_display",
            *additional_attributes,
        ]
        for key in {
            "lcp",
            "fcp",
            "inp",
            "cls",
            "ttfb",
        }:
            trace_attributes.append(f"measurements.{key}")
            trace_attributes.append(f"measurements.score.ratio.{key}")
        resolver = cls.get_resolver(params=params, config=SearchResolverConfig())
        columns, _ = resolver.resolve_attributes(trace_attributes)
        meta = resolver.resolve_meta(referrer=referrer)
        request = GetTraceRequest(
            meta=meta,
            trace_id=trace_id,
            # when this is None we just get the default limit
            limit=options.get("performance.traces.pagination.query-limit"),
            items=[
                GetTraceRequest.TraceItem(
                    item_type=TraceItemType.TRACE_ITEM_TYPE_SPAN,
                    attributes=[col.proto_definition for col in columns],
                )
            ],
        )
        spans: list[dict[str, Any]] = []
        start_time = int(time.time())
        MAX_ITERATIONS = options.get("performance.traces.pagination.max-iterations")
        MAX_TIMEOUT = options.get("performance.traces.pagination.max-timeout")

        @sentry_sdk.tracing.trace
        def process_item_groups(item_groups):
            for item_group in item_groups:
                for span_item in item_group.items:
                    span: dict[str, Any] = {
                        "id": span_item.id,
                        "children": [],
                        "errors": [],
                        "occurrences": [],
                        "event_type": "span",
                    }
                    for attribute in span_item.attributes:
                        resolved_column = columns_by_name[attribute.key.name]
                        if resolved_column.proto_definition.type == STRING:
                            span[resolved_column.public_alias] = attribute.value.val_str
                        elif resolved_column.proto_definition.type == DOUBLE:
                            span[resolved_column.public_alias] = attribute.value.val_double
                        elif resolved_column.search_type == "boolean":
                            span[resolved_column.public_alias] = (
                                attribute.value.val_bool or attribute.value.val_int == 1
                            )
                        elif resolved_column.proto_definition.type == BOOLEAN:
                            span[resolved_column.public_alias] = attribute.value.val_bool

                        elif resolved_column.proto_definition.type == INT:
                            span[resolved_column.public_alias] = attribute.value.val_int
                            if resolved_column.public_alias == "project.id":
                                span["project.slug"] = resolver.params.project_id_map.get(
                                    span[resolved_column.public_alias], "Unknown"
                                )
                    spans.append(span)

        response = snuba_rpc.get_trace_rpc(request)
        for iteration in range(MAX_ITERATIONS):
            columns_by_name = {col.proto_definition.name: col for col in columns}
            if response.page_token.end_pagination:
                # always need to process the last response
                process_item_groups(response.item_groups)
                break
            elif MAX_TIMEOUT > 0 and time.time() - start_time > MAX_TIMEOUT:
                # process the last response even if we've hit timeout cause so we don't waste the time making the request
                process_item_groups(response.item_groups)
                # If timeout is not set then logging this is not helpful
                rpc_debug_json = json.loads(MessageToJson(request))
                logger.info(
                    "running a trace query timed out while paginating",
                    extra={
                        "rpc_query": rpc_debug_json,
                        "referrer": request.meta.referrer,
                        "trace_item_type": request.meta.trace_item_type,
                        "iteration": iteration,
                    },
                )
                sentry_sdk.metrics.distribution(
                    "performance.trace.iteration.count",
                    iteration,
                )
                break
            request.page_token.CopyFrom(response.page_token)
            # We want to process the spans while querying the next page
            with ThreadPoolExecutor(thread_name_prefix=__name__, max_workers=2) as thread_pool:
                _ = thread_pool.submit(process_item_groups, response.item_groups)
                response_future = thread_pool.submit(snuba_rpc.get_trace_rpc, request)
            response = response_future.result()
        return spans

    @classmethod
    @sentry_sdk.trace
    def run_stats_query(
        cls,
        *,
        params: SnubaParams,
        stats_types: set[str],
        query_string: str,
        referrer: str,
        config: SearchResolverConfig,
        search_resolver: SearchResolver | None = None,
        attributes: list[AttributeKey] | None = None,
        max_buckets: int = 75,
        skip_translate_internal_to_public_alias: bool = False,
    ) -> list[dict[str, Any]]:
        search_resolver = search_resolver or cls.get_resolver(params, config)
        stats_filter, _, _ = search_resolver.resolve_query(query_string)
        meta = search_resolver.resolve_meta(
            referrer=referrer,
            sampling_mode=params.sampling_mode,
        )
        stats_request = TraceItemStatsRequest(
            filter=stats_filter,
            meta=meta,
            stats_types=[],
        )

        if not set(stats_types).intersection(SUPPORTED_STATS_TYPES):
            return []

        if "attributeDistributions" in stats_types:
            stats_request.stats_types.append(
                StatsType(
                    attribute_distributions=AttributeDistributionsRequest(
                        max_buckets=max_buckets,
                        attributes=attributes,
                    )
                )
            )

        response = snuba_rpc.trace_item_stats_rpc(stats_request)
        stats = []

        for result in response.results:
            if "attributeDistributions" in stats_types and result.HasField(
                "attribute_distributions"
            ):
                attrs: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
                for attribute in result.attribute_distributions.attributes:
                    if not can_expose_attribute(
                        attribute.attribute_name, SupportedTraceItemType.SPANS
                    ):
                        continue

                    for bucket in attribute.buckets:
                        if skip_translate_internal_to_public_alias:
                            attrs[attribute.attribute_name].append(
                                {"label": bucket.label, "value": bucket.value}
                            )
                        else:
                            public_alias, _, _ = translate_internal_to_public_alias(
                                attribute.attribute_name, "string", SupportedTraceItemType.SPANS
                            )
                            public_alias = public_alias or attribute.attribute_name
                            attrs[public_alias].append(
                                {"label": bucket.label, "value": bucket.value}
                            )
                stats.append({"attribute_distributions": {"data": attrs}})

        return stats
