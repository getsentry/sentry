import sentry_sdk

from collections import defaultdict
from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.snuba import discover
from sentry import features, tagstore


class OrganizationEventsFacetsPerformanceEndpoint(OrganizationEventsV2EndpointBase):
    def has_feature(self, organization, request):
        return features.has(
            "organizations:performance-tag-explorer", organization, actor=request.user
        )

    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        aggregate_column = request.GET.get("aggregateColumn", "duration")
        orderby = request.GET.getlist("order", None)

        with sentry_sdk.start_span(op="discover.endpoint", description="discover_query"):
            with self.handle_query_errors():
                facets = discover.get_performance_facets(
                    query=request.GET.get("query"),
                    params=params,
                    referrer="api.organization-events-facets-performance.top-tags",
                    aggregate_column=aggregate_column,
                    orderby=orderby,
                )

        with sentry_sdk.start_span(op="discover.endpoint", description="populate_results") as span:
            span.set_data("facet_count", len(facets or []))
            resp = defaultdict(lambda: {"key": "", "topValues": []})
            for row in facets:
                values = resp[row.key]
                values["key"] = tagstore.get_standardized_key(row.key)
                values["topValues"].append(
                    {
                        "name": tagstore.get_tag_value_label(row.key, row.value),
                        "value": row.value,
                        "count": row.count,
                        "aggregate": row.performance,
                    }
                )
        return Response(list(resp.values()))
