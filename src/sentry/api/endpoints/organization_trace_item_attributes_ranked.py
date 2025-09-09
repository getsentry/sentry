from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from google.protobuf.json_format import MessageToDict
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.endpoint_trace_item_stats_pb2 import (
    AttributeDistributionsRequest,
    StatsType,
    TraceItemStatsRequest,
)

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

        # if not features.has(
        #     "organizations:performance-spans-suspect-attributes", organization, actor=request.user
        # ):
        #     return Response(status=404)

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

        cohort_1_start_time = request.GET.get("cohort_1_start_time", "2025-09-08T22:00:00Z")
        cohort_1_end_time = request.GET.get("cohort_1_end_time", "2025-09-08T23:35:00Z")
        cohort_1_percentile = request.GET.get("cohort_1_percentile", 90)
        numerical_attribute = request.GET.get("numerical_attribute", "span.duration")

        try:
            percentile_value_int = int(cohort_1_percentile)
            if not (1 <= percentile_value_int <= 100):
                return Response({"error": "Percentile must be between 1 and 100"}, status=400)

        except (ValueError, TypeError):
            return Response({"error": "Invalid percentile value"}, status=400)

        try:
            percentile_result = Spans.run_table_query(
                params=snuba_params,
                query_string=f"timestamp:>={cohort_1_start_time} timestamp:<={cohort_1_end_time}",  # No additional filtering for baseline percentile
                selected_columns=[f"p{percentile_value_int}({numerical_attribute})"],
                orderby=None,
                config=SearchResolverConfig(use_aggregate_conditions=False),
                offset=0,
                limit=1,
                sampling_mode=snuba_params.sampling_mode,
                referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_DATA.value,
            )

            percentile_value = (
                percentile_result["data"][0][f"p{percentile_value_int}({numerical_attribute})"]
                if percentile_result["data"]
                else None
            )
        except Exception:
            percentile_value = None

        cohort_1_query = request.GET.get("query_1", "")  # Suspect query
        cohort_2_query = request.GET.get("query_2", "")  # Baseline query

        cohort_1_query += f" {numerical_attribute}:>={percentile_value}"

        # cohort_1_query = f"timestamp:>={cohort_1_start_time} timestamp:<={cohort_1_end_time} span.duration:>={percentile_value}"
        # cohort_2_query = ""

        if cohort_1_query == cohort_2_query:
            return Response({"rankedAttributes": []})

        cohort_1, _, _ = resolver.resolve_query(cohort_1_query)
        cohort_1_request = TraceItemStatsRequest(
            filter=cohort_1,
            meta=meta,
            stats_types=[
                StatsType(
                    attribute_distributions=AttributeDistributionsRequest(
                        max_buckets=75,
                        max_attributes=100,
                    )
                )
            ],
        )

        cohort_2, _, _ = resolver.resolve_query(cohort_2_query)
        cohort_2_request = TraceItemStatsRequest(
            filter=cohort_2,
            meta=meta,
            stats_types=[
                StatsType(
                    attribute_distributions=AttributeDistributionsRequest(
                        max_buckets=75,
                        max_attributes=100,
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
                query_string=cohort_1_query,
                selected_columns=[f"count({numerical_attribute})"],
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
                query_string=cohort_2_query,
                selected_columns=[f"count({numerical_attribute})"],
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
        for attribute in cohort_1_data.results[0].attribute_distributions.attributes:
            for bucket in attribute.buckets:
                cohort_1_distribution.append((attribute.attribute_name, bucket.label, bucket.value))
                cohort_1_distribution_map[attribute.attribute_name].append(
                    {"label": bucket.label, "value": bucket.value}
                )

        cohort_2_distribution = []
        cohort_2_distribution_map = defaultdict(list)
        for attribute in cohort_2_data.results[0].attribute_distributions.attributes:
            for bucket in attribute.buckets:
                cohort_2_distribution.append((attribute.attribute_name, bucket.label, bucket.value))
                cohort_2_distribution_map[attribute.attribute_name].append(
                    {"label": bucket.label, "value": bucket.value}
                )

        # Calculate baseline distribution (cohort_2_data - cohort_1_data)
        baseline_distribution_map = defaultdict(lambda: defaultdict(int))

        for attribute in cohort_2_data.results[0].attribute_distributions.attributes:
            for bucket in attribute.buckets:
                baseline_distribution_map[attribute.attribute_name][bucket.label] += bucket.value

        for attribute in cohort_1_data.results[0].attribute_distributions.attributes:
            for bucket in attribute.buckets:
                baseline_distribution_map[attribute.attribute_name][bucket.label] -= bucket.value

        baseline_distribution_rrf = []
        for attribute_name, buckets in baseline_distribution_map.items():
            for label, value in buckets.items():
                final_value = max(0, value)
                if final_value > 0:
                    baseline_distribution_rrf.append((attribute_name, label, final_value))

        baseline_total_count = sum(value for _, _, value in baseline_distribution_rrf)

        baseline_distribution_seer = {
            "attributeDistributions": {"attributes": []},
            "totalCount": baseline_total_count,
        }

        baseline_seer_map = defaultdict(list)
        for attribute_name, label, value in baseline_distribution_rrf:
            if value > 0:
                baseline_seer_map[attribute_name].append(
                    {
                        "attributeValue": label,
                        "attributeValueCount": value,
                    }
                )

        for attribute_name, buckets in baseline_seer_map.items():
            baseline_distribution_seer["attributeDistributions"]["attributes"].append(
                {"attributeName": attribute_name, "buckets": buckets}
            )

        baseline_distribution_display_map = defaultdict(list)
        for attribute_name, buckets in baseline_distribution_map.items():
            for label, value in buckets.items():
                final_value = max(0.0, float(value))
                if final_value > 0:
                    baseline_distribution_display_map[attribute_name].append(
                        {"label": label, "value": final_value}
                    )

        scored_attrs = keyed_rrf_score(
            baseline_distribution_rrf,
            cohort_1_distribution,
            baseline_total_count,
            totals_1_result["data"][0]["count(span.duration)"],
        )

        def transform_cohort_data(cohort_data_dict, total_count):
            """Transform MessageToDict output to compare_distributions expected format"""
            transformed = {"attributeDistributions": {"attributes": []}}

            if (
                "attributeDistributions" in cohort_data_dict
                and "attributes" in cohort_data_dict["attributeDistributions"]
            ):
                for attr in cohort_data_dict["attributeDistributions"]["attributes"]:
                    transformed_attr = {"attributeName": attr["attributeName"], "buckets": []}

                    if "buckets" in attr:
                        for bucket in attr["buckets"]:
                            transformed_bucket = {
                                "attributeValue": bucket.get("label", ""),
                                "attributeValueCount": bucket.get("value", 0.0),
                            }
                            transformed_attr["buckets"].append(transformed_bucket)

                    transformed["attributeDistributions"]["attributes"].append(transformed_attr)

            transformed["totalCount"] = total_count

            return transformed

        selection_data = transform_cohort_data(
            MessageToDict(cohort_2_data.results[0]),
            totals_2_result["data"][0]["count(span.duration)"],
        )

        seer_scored_attrs = compare_distributions(
            baseline_distribution_seer,
            selection_data,
            {
                "topKAttributes": 100,
                "topKBuckets": 75,
            },
            {
                "referrer": "eap_referrer_value",
            },
        )

        seer_results = seer_scored_attrs.get("results", [])
        sorted_seer_attrs = sorted(
            seer_results, key=lambda x: x.get("attributeScore", 0), reverse=True
        )

        rrr_order_map = {attr["attributeName"]: i for i, attr in enumerate(sorted_seer_attrs)}

        ranked_distribution: dict[str, Any] = {
            "rankedAttributes": [],
            "percentileInfo": {
                "percentile": percentile_value_int,
                "value": percentile_value,
                "startTime": cohort_1_start_time,
                "endTime": cohort_1_end_time,
            },
        }

        for i, (attr, _) in enumerate(scored_attrs):
            distribution = {
                "attributeName": translate_internal_to_public_alias(
                    attr, "string", SupportedTraceItemType.SPANS
                )[0]
                or attr,
                "cohort1": cohort_1_distribution_map.get(attr),
                "cohort2": baseline_distribution_display_map.get(attr),
                "order": {
                    "rrf": i,
                    "rrr": rrr_order_map.get(attr),
                },
            }
            ranked_distribution["rankedAttributes"].append(distribution)

        return Response(ranked_distribution)
