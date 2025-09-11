from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Any

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
from sentry.search.eap.spans.definitions import SPAN_DEFINITIONS
from sentry.search.eap.types import SearchResolverConfig, SupportedTraceItemType
from sentry.search.eap.utils import translate_internal_to_public_alias
from sentry.seer.endpoints.compare import compare_distributions
from sentry.seer.workflows.compare import keyed_rrf_score
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.snuba_rpc import trace_item_stats_rpc


@region_silo_endpoint
class OrganizationTraceItemsAttributesRankedEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.VISIBILITY

    def get(self, request: Request, organization: Organization) -> Response:

        if not features.has(
            "organizations:performance-spans-suspect-attributes", organization, actor=request.user
        ):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"rankedAttributes": []})

        resolver = SearchResolver(
            params=snuba_params, config=SearchResolverConfig(), definitions=SPAN_DEFINITIONS
        )

        meta = resolver.resolve_meta(
            referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC.value,
            sampling_mode=snuba_params.sampling_mode,
        )

        function_name = request.GET.get("function_name", "count")
        function_parameter = request.GET.get("function_parameter", "")
        above = request.GET.get("above", True)
        should_segment_suspect_cohort = function_name not in [
            "count",
            "count_unique",
            "sum",
            "min",
            "max",
            "epm",
            "failure_rate",
        ]

        query_1 = request.GET.get("query_1", "")  # Suspect query
        query_2 = request.GET.get("query_2", "")  # Query for all the spans with the base query

        # Only segment on percentile functions
        function_value = None
        if should_segment_suspect_cohort:
            function_result = Spans.run_table_query(
                params=snuba_params,
                query_string=query_1,
                selected_columns=[f"{function_name}({function_parameter})"],
                orderby=None,
                config=SearchResolverConfig(use_aggregate_conditions=False),
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
            query_1 += (
                f" {function_parameter}:>={function_value}"
                if above
                else f" {function_parameter}:<={function_value}"
            )

        if query_1 == query_2:
            return Response({"rankedAttributes": []})

        cohort_1, _, _ = resolver.resolve_query(query_1)
        cohort_1_request = TraceItemStatsRequest(
            filter=cohort_1,
            meta=meta,
            stats_types=[
                StatsType(
                    attribute_distributions=AttributeDistributionsRequest(
                        max_buckets=75,
                    )
                )
            ],
        )

        cohort_2, _, _ = resolver.resolve_query(query_2)
        cohort_2_request = TraceItemStatsRequest(
            filter=cohort_2,
            meta=meta,
            stats_types=[
                StatsType(
                    attribute_distributions=AttributeDistributionsRequest(
                        max_buckets=75,
                    )
                )
            ],
        )

        with ThreadPoolExecutor(
            thread_name_prefix=__name__,
            max_workers=4,
        ) as query_thread_pool:
            cohort_1_future = query_thread_pool.submit(
                trace_item_stats_rpc,
                cohort_1_request,
            )
            totals_1_future = query_thread_pool.submit(
                Spans.run_table_query,
                params=snuba_params,
                query_string=query_1,
                selected_columns=[f"count({function_parameter})"],
                orderby=None,
                config=SearchResolverConfig(use_aggregate_conditions=False),
                offset=0,
                limit=1,
                sampling_mode=snuba_params.sampling_mode,
                referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_DATA.value,
            )

            cohort_2_future = query_thread_pool.submit(
                trace_item_stats_rpc,
                cohort_2_request,
            )

            totals_2_future = query_thread_pool.submit(
                Spans.run_table_query,
                params=snuba_params,
                query_string=query_2,
                selected_columns=[f"count({function_parameter})"],
                orderby=None,
                config=SearchResolverConfig(use_aggregate_conditions=False),
                offset=0,
                limit=1,
                sampling_mode=snuba_params.sampling_mode,
                referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_DATA.value,
            )

        cohort_1_data = cohort_1_future.result()
        cohort_2_data = cohort_2_future.result()

        totals_1_result = totals_1_future.result()
        totals_2_result = totals_2_future.result()

        cohort_1_distribution = []
        cohort_1_distribution_map = defaultdict(list)

        cohort_2_distribution = []
        cohort_2_distribution_map = defaultdict(list)

        for attribute in cohort_2_data.results[0].attribute_distributions.attributes:
            for bucket in attribute.buckets:
                cohort_2_distribution_map[attribute.attribute_name].append(
                    {"label": bucket.label, "value": bucket.value}
                )

        for attribute in cohort_1_data.results[0].attribute_distributions.attributes:
            for bucket in attribute.buckets:
                cohort_1_distribution.append((attribute.attribute_name, bucket.label, bucket.value))
                cohort_1_distribution_map[attribute.attribute_name].append(
                    {"label": bucket.label, "value": bucket.value}
                )

                for cohort_2_bucket in cohort_2_distribution_map[attribute.attribute_name]:
                    if cohort_2_bucket["label"] == bucket.label:
                        baseline_value = max(0, cohort_2_bucket["value"] - bucket.value)
                        cohort_2_bucket["value"] = baseline_value
                        cohort_2_distribution.append(
                            (attribute.attribute_name, bucket.label, baseline_value)
                        )
                        break

        scored_attrs_rrf = keyed_rrf_score(
            baseline=cohort_2_distribution,
            outliers=cohort_1_distribution,
            total_outliers=int(totals_1_result["data"][0][f"count({function_parameter})"]),
            total_baseline=int(totals_2_result["data"][0][f"count({function_parameter})"]),
        )

        suspect_distribution = self._convert_to_seer_distribution(cohort_1_distribution_map)
        baseline_distribution = self._convert_to_seer_distribution(cohort_2_distribution_map)

        scored_attrs_rrr = compare_distributions(
            baseline=baseline_distribution,
            outliers=suspect_distribution,
            config={
                "topKAttributes": 75,
                "topKBuckets": 75,
            },
            meta={
                "referrer": Referrer.API_TRACE_EXPLORER_STATS.value,
            },
        )

        sorted_rrr_results = sorted(
            scored_attrs_rrr["results"], key=lambda x: x.get("attributeScore", 0), reverse=True
        )
        rrr_order_map = {attr["attributeName"]: i for i, attr in enumerate(sorted_rrr_results)}

        ranked_distribution: dict[str, Any] = {
            "rankedAttributes": [],
            "rankingInfo": {
                "functionName": function_name,
                "functionParameter": function_parameter,
                "value": function_value if function_value else "N/A",
                "above": above,
            },
        }

        for i, (attr, _) in enumerate(scored_attrs_rrf):
            distribution = {
                "attributeName": translate_internal_to_public_alias(
                    attr, "string", SupportedTraceItemType.SPANS
                )[0]
                or attr,
                "cohort1": cohort_1_distribution_map.get(attr),
                "cohort2": cohort_2_distribution_map.get(attr),
                "order": {
                    "rrf": i,
                    "rrr": rrr_order_map.get(attr),
                },
            }
            ranked_distribution["rankedAttributes"].append(distribution)

        return Response(ranked_distribution)

    def _convert_to_seer_distribution(self, distribution: dict[str, Any]) -> dict[str, Any]:
        total_count = sum(
            sum(bucket["value"] for bucket in buckets) for buckets in distribution.values()
        )
        return {
            "attributeDistributions": {
                "attributes": [
                    {
                        "attributeName": attr_name,
                        "buckets": [
                            {
                                "attributeValue": bucket["label"],
                                "attributeValueCount": bucket["value"],
                            }
                            for bucket in buckets
                        ],
                    }
                    for attr_name, buckets in distribution.items()
                ]
            },
            "totalCount": total_count,
        }
