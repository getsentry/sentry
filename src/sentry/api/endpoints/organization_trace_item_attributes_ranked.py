import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Any, cast

from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_attributes_pb2 import TraceItemAttributeNamesRequest
from sentry_protos.snuba.v1.endpoint_trace_item_stats_pb2 import (
    AttributeDistributionsRequest,
    StatsType,
    TraceItemStatsRequest,
)
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, ExtrapolationMode

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_trace_item_attributes import adjust_start_end_window
from sentry.api.utils import handle_query_errors
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.spans.attributes import SPANS_STATS_EXCLUDED_ATTRIBUTES
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.eap.utils import can_expose_attribute, translate_internal_to_public_alias
from sentry.search.events import fields
from sentry.seer.endpoints.compare import compare_distributions
from sentry.seer.workflows.compare import keyed_rrf_score
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils import snuba_rpc
from sentry.utils.snuba_rpc import trace_item_stats_rpc

logger = logging.getLogger(__name__)

PARALLELIZATION_FACTOR = 2


@region_silo_endpoint
class OrganizationTraceItemsAttributesRankedEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING

    def get(self, request: Request, organization: Organization) -> Response:

        if not features.has(
            "organizations:performance-spans-suspect-attributes", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"rankedAttributes": []})

        resolver_config = SearchResolverConfig(
            extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE
        )

        resolver = SearchResolver(
            params=snuba_params, config=resolver_config, definitions=SPAN_DEFINITIONS
        )

        meta = resolver.resolve_meta(
            referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC.value,
            sampling_mode=snuba_params.sampling_mode,
        )

        function_string = request.GET.get("function", "count(span.duration)")
        above = request.GET.get("above") == "1"

        match = fields.is_function(function_string)
        if match is None:
            raise InvalidSearchQuery(f"{function_string} is not a function")

        function_name = match.group("function")
        columns = match.group("columns")
        arguments = fields.parse_arguments(function_name, columns)

        should_segment_suspect_cohort = len(arguments) == 1 and function_name in [
            "avg",
            "p50",
            "p75",
            "p90",
            "p95",
            "p99",
            "p100",
        ]

        function_parameter = arguments[0] if len(arguments) == 1 else None

        query_1 = request.GET.get("query_1", "")  # Suspect query
        query_2 = request.GET.get("query_2", "")  # Query for all the spans with the base query

        # For failure_rate, we want to compare failed spans specifically,
        # not all spans. Sentry treats spans with status other than "ok",
        # "cancelled", and "unknown" as failures.
        is_failure_rate = function_name == "failure_rate"
        if is_failure_rate:
            failure_filter = "has:span.status !span.status:[ok,cancelled,unknown]"
            query_1 = f"({query_1}) {failure_filter}" if query_1 else failure_filter
            query_2 = f"({query_2}) {failure_filter}" if query_2 else failure_filter

        # Only segment on percentile functions
        function_value = None
        if should_segment_suspect_cohort:
            function_result = Spans.run_table_query(
                params=snuba_params,
                query_string=query_1,
                selected_columns=[f"{function_name}({function_parameter})"],
                orderby=None,
                config=resolver_config,
                offset=0,
                limit=1,
                sampling_mode=snuba_params.sampling_mode,
                referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_DATA.value,
            )
            function_value = (
                function_result["data"][0][f"{function_name}({function_parameter})"]
                if function_result["data"]
                else None
            )
            if function_value is not None:
                query_1 = (
                    f"({query_1}) AND {function_parameter}:>={function_value}"
                    if above
                    else f"({query_1}) AND {function_parameter}:<={function_value}"
                )

        if query_1 == query_2:
            return Response({"rankedAttributes": []})

        cohort_1, _, _ = resolver.resolve_query(query_1)
        cohort_2, _, _ = resolver.resolve_query(query_2)

        # Fetch attribute names for parallelization
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
            )
            attrs_response = snuba_rpc.attribute_names_rpc(attrs_request)

        # Chunk attributes for parallel processing
        chunked_attributes: defaultdict[int, list[AttributeKey]] = defaultdict(list)
        for i, attr_proto in enumerate(attrs_response.attributes):
            if attr_proto.name in SPANS_STATS_EXCLUDED_ATTRIBUTES:
                continue

            chunked_attributes[i % PARALLELIZATION_FACTOR].append(
                AttributeKey(name=attr_proto.name, type=AttributeKey.TYPE_STRING)
            )

        def run_stats_request_with_error_handling(filter, attributes):
            with handle_query_errors():
                request = TraceItemStatsRequest(
                    filter=filter,
                    meta=meta,
                    stats_types=[
                        StatsType(
                            attribute_distributions=AttributeDistributionsRequest(
                                max_buckets=75,
                                attributes=attributes,
                            )
                        )
                    ],
                )
                return trace_item_stats_rpc(request)

        def run_table_query_with_error_handling(query_string):
            with handle_query_errors():
                return Spans.run_table_query(
                    params=snuba_params,
                    query_string=query_string,
                    selected_columns=["count(span.duration)"],
                    orderby=None,
                    config=resolver_config,
                    offset=0,
                    limit=1,
                    sampling_mode=snuba_params.sampling_mode,
                    referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_DATA.value,
                )

        with ThreadPoolExecutor(
            thread_name_prefix=__name__,
            max_workers=PARALLELIZATION_FACTOR * 2 + 2,  # 2 cohorts * threads + 2 totals queries
        ) as query_thread_pool:
            cohort_1_futures = [
                query_thread_pool.submit(
                    run_stats_request_with_error_handling, cohort_1, attributes
                )
                for attributes in chunked_attributes.values()
            ]
            cohort_2_futures = [
                query_thread_pool.submit(
                    run_stats_request_with_error_handling, cohort_2, attributes
                )
                for attributes in chunked_attributes.values()
            ]

            totals_1_future = query_thread_pool.submit(run_table_query_with_error_handling, query_1)
            totals_2_future = query_thread_pool.submit(run_table_query_with_error_handling, query_2)

            # Merge cohort 1 results
            cohort_1_data = []
            for future in cohort_1_futures:
                result = future.result()
                if result.results:
                    cohort_1_data.extend(result.results[0].attribute_distributions.attributes)

            # Merge cohort 2 results
            cohort_2_data = []
            for future in cohort_2_futures:
                result = future.result()
                if result.results:
                    cohort_2_data.extend(result.results[0].attribute_distributions.attributes)

            totals_1_result = totals_1_future.result()
            totals_2_result = totals_2_future.result()

        cohort_1_distribution = []
        cohort_1_distribution_map = defaultdict(list)

        cohort_2_distribution = []
        cohort_2_distribution_map = defaultdict(list)
        processed_cohort_2_buckets = set()

        for attribute in cohort_2_data:
            if not can_expose_attribute(attribute.attribute_name, SupportedTraceItemType.SPANS):
                continue

            for bucket in attribute.buckets:
                cohort_2_distribution_map[attribute.attribute_name].append(
                    {"label": bucket.label, "value": bucket.value}
                )

        for attribute in cohort_1_data:
            if not can_expose_attribute(attribute.attribute_name, SupportedTraceItemType.SPANS):
                continue
            for bucket in attribute.buckets:
                cohort_1_distribution.append((attribute.attribute_name, bucket.label, bucket.value))
                cohort_1_distribution_map[attribute.attribute_name].append(
                    {"label": bucket.label, "value": bucket.value}
                )

                # Calculate the baseline value for the suspect cohort
                # If a value exists in the suspect, but not the baseline we should clip the value to 0
                for cohort_2_bucket in cohort_2_distribution_map[attribute.attribute_name]:
                    if cohort_2_bucket["label"] == bucket.label:
                        baseline_value = max(
                            0, cast(float, cohort_2_bucket["value"]) - bucket.value
                        )
                        cohort_2_bucket["value"] = baseline_value
                        cohort_2_distribution.append(
                            (attribute.attribute_name, bucket.label, baseline_value)
                        )
                        processed_cohort_2_buckets.add((attribute.attribute_name, bucket.label))
                        break

        # Add remaining cohort_2 buckets that weren't in cohort_1 (exist only in baseline)
        cohort_2_distribution.extend(
            [
                (attribute_name, cast(str, bucket["label"]), cast(float, bucket["value"]))
                for attribute_name, buckets in cohort_2_distribution_map.items()
                for bucket in buckets
                if (attribute_name, bucket["label"]) not in processed_cohort_2_buckets
            ]
        )

        total_outliers = (
            int(totals_1_result["data"][0]["count(span.duration)"])
            if totals_1_result.get("data")
            else 0
        )
        total_spans = (
            int(totals_2_result["data"][0]["count(span.duration)"])
            if totals_2_result.get("data")
            else 0
        )
        total_baseline = total_spans - total_outliers

        scored_attrs_rrf = keyed_rrf_score(
            baseline=cohort_2_distribution,
            outliers=cohort_1_distribution,
            total_outliers=total_outliers,
            total_baseline=total_baseline,
        )

        logger.info(
            "compare_distributions params: baseline=%s, outliers=%s, total_outliers=%s, total_baseline=%s, config=%s, meta=%s",
            cohort_2_distribution,
            cohort_1_distribution,
            total_outliers,
            total_baseline,
            {"topKAttributes": 75, "topKBuckets": 75},
            {"referrer": Referrer.API_TRACE_EXPLORER_STATS.value},
        )

        scored_attrs_rrr = compare_distributions(
            baseline=cohort_2_distribution,
            outliers=cohort_1_distribution,
            total_outliers=total_outliers,
            total_baseline=total_baseline,
            config={
                "topKAttributes": 75,
                "topKBuckets": 75,
            },
            meta={
                "referrer": Referrer.API_TRACE_EXPLORER_STATS.value,
            },
        )
        logger.info("scored_attrs_rrr: %s", scored_attrs_rrr)

        # Create RRR order mapping from compare_distributions results
        # scored_attrs_rrr returns a dict with 'results' key containing list of [attribute_name, score] pairs
        rrr_results = scored_attrs_rrr.get("results", [])
        rrr_order_map = {attr_name: i for i, (attr_name, _) in enumerate(rrr_results)}

        ranked_distribution: dict[str, Any] = {
            "rankedAttributes": [],
            "rankingInfo": {
                "function": function_string,
                "value": function_value if function_value else "N/A",
                "above": above,
            },
            "cohort1Total": total_outliers,
            "cohort2Total": total_baseline,
        }

        for i, scored_attr_tuple in enumerate(scored_attrs_rrf):
            attr = scored_attr_tuple[0]

            public_alias, _, _ = translate_internal_to_public_alias(
                attr, "string", SupportedTraceItemType.SPANS
            )
            if public_alias is None:
                public_alias = attr

            if not public_alias.startswith("tags[") and (
                not public_alias.startswith("sentry.")
                or public_alias == "sentry.normalized_description"
            ):
                distribution = {
                    "attributeName": public_alias,
                    "cohort1": cohort_1_distribution_map.get(attr),
                    "cohort2": cohort_2_distribution_map.get(attr),
                    "order": {  # TODO: aayush-se remove this once we have selected a single ranking method
                        "rrf": i,
                        "rrr": rrr_order_map.get(attr),
                    },
                }
                ranked_distribution["rankedAttributes"].append(distribution)

        return Response(ranked_distribution)
