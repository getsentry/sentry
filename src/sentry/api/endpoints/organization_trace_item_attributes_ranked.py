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
from sentry.seer.workflows.compare import keyed_rrf_score
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import run_table_query
from sentry.utils.snuba_rpc import trace_item_stats_rpc

_query_thread_pool = ThreadPoolExecutor(max_workers=4)


@region_silo_endpoint
class OrganizationTraceItemsAttributesRankedEndpoint(OrganizationEventsV2EndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.PERFORMANCE

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

        meta = resolver.resolve_meta(referrer=Referrer.API_SPANS_FREQUENCY_STATS_RPC.value)
        query_1 = request.GET.get("query_1", "")
        query_2 = request.GET.get("query_2", "")

        if query_1 == query_2:
            return Response({"rankedAttributes": []})

        cohort_1, _, _ = resolver.resolve_query(query_1)
        cohort_1_request = TraceItemStatsRequest(
            filter=cohort_1,
            meta=meta,
            stats_types=[
                StatsType(
                    attribute_distributions=AttributeDistributionsRequest(
                        max_buckets=100,
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
                        max_buckets=100,
                    )
                )
            ],
        )

        cohort_1_future = _query_thread_pool.submit(
            trace_item_stats_rpc,
            cohort_1_request,
        )
        totals_1_future = _query_thread_pool.submit(
            run_table_query,
            snuba_params,
            query_1,
            ["count(span.duration)"],
            None,
            config=SearchResolverConfig(use_aggregate_conditions=False),
            offset=0,
            limit=1,
            sampling_mode=snuba_params.sampling_mode,
            referrer=Referrer.API_SPAN_SAMPLE_GET_SPAN_DATA.value,
        )

        cohort_2_future = _query_thread_pool.submit(
            trace_item_stats_rpc,
            cohort_2_request,
        )

        totals_2_future = _query_thread_pool.submit(
            run_table_query,
            snuba_params,
            query_2,
            ["count(span.duration)"],
            None,
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

        scored_attrs = keyed_rrf_score(
            cohort_1_distribution,
            cohort_2_distribution,
            totals_1_result["data"][0]["count(span.duration)"],
            totals_2_result["data"][0]["count(span.duration)"],
        )

        ranked_distribution: dict[str, list[dict[str, Any]]] = {"rankedAttributes": []}
        for attr, _ in scored_attrs:
            distribution = {
                "attributeName": translate_internal_to_public_alias(
                    attr, "string", SupportedTraceItemType.SPANS
                )
                or attr,
                "cohort1": cohort_1_distribution_map.get(attr),
                "cohort2": cohort_2_distribution_map.get(attr),
            }
            ranked_distribution["rankedAttributes"].append(distribution)

        return Response(ranked_distribution)
