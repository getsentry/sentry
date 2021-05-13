from typing import Any, Dict, Mapping, Optional

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import features, tagstore
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.endpoints.organization_events_facets_performance import (
    ALLOWED_AGGREGATE_COLUMNS,
    query_tag_data,
)
from sentry.api.paginator import GenericOffsetPaginator
from sentry.snuba import discover

TAG_PAGE_MAX_TAG_VALUES = 5


class OrganizationEventsFacetsPerformanceHistogramEndpoint(OrganizationEventsV2EndpointBase):
    def has_feature(self, organization, request):
        return features.has("organizations:performance-tag-page", organization, actor=request.user)

    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        filter_query = request.GET.get("query")
        aggregate_column = request.GET.get("aggregateColumn")

        tag_key = request.GET.get("tagKey")

        if not aggregate_column:
            raise ParseError(detail="'aggregateColumn' must be provided.")

        if aggregate_column not in ALLOWED_AGGREGATE_COLUMNS:
            raise ParseError(detail=f"'{aggregate_column}' is not a supported tags column.")

        if len(params.get("project_id", [])) > 1:
            raise ParseError(detail="You cannot view facet performance for multiple projects.")

        if not tag_key:
            raise ParseError(detail="'tagKey' must be provided when using histograms.")

        def data_fn(offset, limit):
            with sentry_sdk.start_span(op="discover.endpoint", description="discover_query"):
                referrer = "api.organization-events-facets-performance-histogram.top-tags"
                tag_data = query_tag_data(
                    filter_query=filter_query,
                    aggregate_column=aggregate_column,
                    referrer=referrer,
                    params=params,
                )

                if not tag_data:
                    return {"data": []}

                results = query_facet_performance_key_histogram(
                    tag_data=tag_data,
                    tag_key=tag_key,
                    filter_query=filter_query,
                    aggregate_column=aggregate_column,
                    referrer=referrer,
                    orderby=self.get_orderby(request),
                    params=params,
                )

                if not results:
                    return {"data": []}

                for row in results["data"]:
                    row["tags_value"] = tagstore.get_tag_value_label(
                        row["tags_key"], row["tags_value"]
                    )
                    row["tags_key"] = tagstore.get_standardized_key(row["tags_key"])

                return results

        with self.handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=lambda results: self.handle_results_with_meta(
                    request, organization, params["project_id"], results
                ),
            )


def query_facet_performance_key_histogram(
    params: Mapping[str, str],
    tag_data: Mapping[str, Any],
    tag_key: str,
    aggregate_column: Optional[str] = None,
    filter_query: Optional[str] = None,
    orderby: Optional[str] = None,
    referrer: Optional[str] = None,
) -> Dict:
    precision = 0
    num_buckets = 100
    min_value = tag_data["min"]
    max_value = tag_data["max"]

    results = discover.histogram_query(
        [aggregate_column],
        filter_query,
        params,
        num_buckets,
        precision,
        min_value=min_value,
        max_value=max_value,
        referrer="api.organization-events-facets-performance-histogram",
        group_by=["tags_value", "tags_key"],
        extra_conditions=[["tags_key", "IN", [tag_key]]],
        normalize_results=False,
    )
    return results
