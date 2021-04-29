import math
from typing import Mapping, Optional

import sentry_sdk
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.snuba import discover
from sentry.utils.snuba import Dataset


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

        filter_query = request.GET.get("query")
        aggregate_column = request.GET.get("aggregateColumn", "duration")

        orderby = request.GET.get("order", None)

        if len(params.get("project_id", [])) > 1:
            raise ParseError(detail="You cannot view facet performance for multiple projects.")

        def data_fn(offset, limit):
            with sentry_sdk.start_span(op="discover.endpoint", description="discover_query"):
                with self.handle_query_errors():
                    referrer = "api.organization-events-facets-performance.top-tags"
                    tag_data = query_tag_data(
                        filter_query=filter_query,
                        aggregate_column=aggregate_column,
                        orderby=orderby,
                        referrer=referrer,
                        params=params,
                    )

                    if not tag_data:
                        return {"data": []}

                    results = query_facet_performance(
                        tag_data=tag_data,
                        filter_query=filter_query,
                        aggregate_column=aggregate_column,
                        orderby=orderby,
                        referrer=referrer,
                        limit=limit,
                        offset=offset,
                        params=params,
                    )

                    if not results:
                        return {"data": []}

                    return results

        with self.handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=lambda results: self.handle_results_with_meta(
                    request, organization, params["project_id"], results
                ),
                default_per_page=5,
                max_per_page=5,
            )


def query_tag_data(
    params: Mapping[str, str],
    filter_query: Optional[str] = None,
    aggregate_column: Optional[str] = None,
    orderby: Optional[str] = None,
    referrer: Optional[str] = None,
):
    with sentry_sdk.start_span(
        op="discover.discover", description="facets.filter_transform"
    ) as span:
        span.set_data("query", filter_query)
        snuba_filter = discover.get_filter(filter_query, params)

        # Resolve the public aliases into the discover dataset names.
        snuba_filter, translated_columns = discover.resolve_discover_aliases(snuba_filter)

    # TODO(k-fish): Remove this and pass aliases instead, we can convert them back for raw_query
    column_map = {
        "duration": "transaction.duration",
        "measurements[lcp]": "measurements.lcp",
        "span_op_breakdowns[ops.browser]": "spans.browser",
        "span_op_breakdowns[ops.http]": "spans.http",
        "span_op_breakdowns[ops.db]": "spans.db",
        "span_op_breakdowns[ops.resource]": "spans.resource",
    }

    mapped_aggregate_column = column_map.get(aggregate_column)

    # Only operate on allowed columns
    if not mapped_aggregate_column:
        return None

    initial_selected_columns = ["count()", f"avg({mapped_aggregate_column}) as aggregate"]

    with sentry_sdk.start_span(op="discover.discover", description="facets.frequent_tags"):
        # Get the most relevant tag keys
        tag_data = discover.query(
            selected_columns=initial_selected_columns,
            query=filter_query,
            params=params,
            orderby=["-count"],
            referrer="{}.{}".format(referrer, "all_transactions"),
        )
        counts = [r["count"] for r in tag_data["data"]]
        aggregates = [r["aggregate"] for r in tag_data["data"]]

        # Return early to avoid doing more queries with 0 count transactions or aggregates for columns that dont exist
        if len(counts) != 1 or counts[0] == 0 or aggregates[0] is None:
            return None
    if not tag_data["data"][0]:
        return None
    return tag_data["data"][0]


def query_facet_performance(
    params: Mapping[str, str],
    tag_data: Mapping[str, object],
    aggregate_column: Optional[str] = None,
    filter_query: Optional[str] = None,
    orderby: Optional[str] = None,
    referrer: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
):
    with sentry_sdk.start_span(
        op="discover.discover", description="facets.filter_transform"
    ) as span:
        span.set_data("query", filter_query)
        snuba_filter = discover.get_filter(filter_query, params)

        # Resolve the public aliases into the discover dataset names.
        snuba_filter, translated_columns = discover.resolve_discover_aliases(snuba_filter)

    # Aggregate for transaction
    transaction_aggregate = tag_data["aggregate"]

    # Dynamically sample so at least 50000 transactions are selected
    transaction_count = tag_data["count"]
    sampling_enabled = transaction_count > 50000

    # log-e growth starting at 50,000
    target_sample = max(
        50000 * (math.log(transaction_count) - (math.log(50000) - 1)), transaction_count
    )

    dynamic_sample_rate = 0 if transaction_count <= 0 else (target_sample / transaction_count)
    sample_rate = min(max(dynamic_sample_rate, 0), 1) if sampling_enabled else None
    frequency_sample_rate = sample_rate if sample_rate else 1

    excluded_tags = [
        "tags_key",
        "NOT IN",
        ["trace", "trace.ctx", "trace.span", "project", "browser", "celery_task_id", "url"],
    ]

    with sentry_sdk.start_span(op="discover.discover", description="facets.aggregate_tags"):
        span.set_data("sample_rate", sample_rate)
        span.set_data("target_sample", target_sample)
        conditions = snuba_filter.conditions
        aggregate_comparison = transaction_aggregate * 1.005 if transaction_aggregate else 0
        having = [excluded_tags]
        having.append(["aggregate", ">", aggregate_comparison])

        if orderby is None:
            orderby = []
        else:
            orderby = [orderby]

        snuba_filter.conditions.append([aggregate_column, "IS NOT NULL", None])

        tag_selected_columns = [
            [
                "sum",
                [
                    "minus",
                    [
                        aggregate_column,
                        str(transaction_aggregate),
                    ],
                ],
                "sumdelta",
            ],
            ["count", [], "count"],
            [
                "divide",
                [
                    [
                        "divide",
                        [["count", []], frequency_sample_rate],
                    ],
                    transaction_count,
                ],
                "frequency",
            ],
            ["divide", ["aggregate", transaction_aggregate], "comparison"],
            ["avg", [aggregate_column], "aggregate"],
        ]

        results = discover.raw_query(
            selected_columns=tag_selected_columns,
            conditions=conditions,
            start=snuba_filter.start,
            end=snuba_filter.end,
            filter_keys=snuba_filter.filter_keys,
            orderby=orderby + ["tags_key"],
            groupby=["tags_key", "tags_value"],
            having=having,
            dataset=Dataset.Discover,
            referrer="{}.{}".format(referrer, "tag_values"),
            sample=sample_rate,
            turbo=sample_rate is not None,
            limitby=[1, "tags_key"],
            limit=limit,
            offset=offset,
        )

        results["meta"] = discover.transform_meta(results, {})

        return results
    return {"data": []}
