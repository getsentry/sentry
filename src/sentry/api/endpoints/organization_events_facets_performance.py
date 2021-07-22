import math
from typing import Any, Dict, List, Mapping, Optional

import sentry_sdk
from django.http import Http404
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry import features, tagstore
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.search.events.filter import get_filter
from sentry.snuba import discover
from sentry.utils.snuba import Dataset

ALLOWED_AGGREGATE_COLUMNS = {
    "transaction.duration",
    "measurements.lcp",
    "spans.browser",
    "spans.http",
    "spans.db",
    "spans.resource",
}

TAG_ALIASES = {"release": "sentry:release", "dist": "sentry:dist", "user": "sentry:user"}


class OrganizationEventsFacetsPerformanceEndpointBase(OrganizationEventsV2EndpointBase):
    def has_feature(self, organization, request):
        return features.has(
            "organizations:performance-tag-explorer", organization, actor=request.user
        )

    def has_tag_page_feature(self, organization, request):
        return features.has("organizations:performance-tag-page", organization, actor=request.user)

    def setup(self, request, organization):
        if not (
            self.has_feature(organization, request)
            or self.has_tag_page_feature(organization, request)
        ):
            raise Http404

        params = self.get_snuba_params(request, organization)

        filter_query = request.GET.get("query")
        aggregate_column = request.GET.get("aggregateColumn")

        if not aggregate_column:
            raise ParseError(detail="'aggregateColumn' must be provided.")

        if aggregate_column not in ALLOWED_AGGREGATE_COLUMNS:
            raise ParseError(detail=f"'{aggregate_column}' is not a supported tags column.")

        if len(params.get("project_id", [])) > 1:
            raise ParseError(detail="You cannot view facet performance for multiple projects.")

        return params, aggregate_column, filter_query


class OrganizationEventsFacetsPerformanceEndpoint(OrganizationEventsFacetsPerformanceEndpointBase):
    def get(self, request, organization):
        try:
            params, aggregate_column, filter_query = self.setup(request, organization)
        except NoProjects:
            return Response([])

        all_tag_keys = None
        tag_key = None

        if self.has_tag_page_feature(organization, request):
            all_tag_keys = request.GET.get("allTagKeys")
            tag_key = request.GET.get("tagKey")

        if tag_key in TAG_ALIASES:
            tag_key = TAG_ALIASES.get(tag_key)

        def data_fn(offset, limit):
            with sentry_sdk.start_span(op="discover.endpoint", description="discover_query"):
                referrer = "api.organization-events-facets-performance.top-tags"
                tag_data = query_tag_data(
                    filter_query=filter_query,
                    aggregate_column=aggregate_column,
                    referrer=referrer,
                    params=params,
                )

                if not tag_data:
                    return {"data": []}

                results = query_facet_performance(
                    tag_data=tag_data,
                    filter_query=filter_query,
                    aggregate_column=aggregate_column,
                    referrer=referrer,
                    orderby=self.get_orderby(request),
                    limit=limit,
                    offset=offset,
                    params=params,
                    all_tag_keys=all_tag_keys,
                    tag_key=tag_key,
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
                default_per_page=5,
                max_per_page=20,
            )


class OrganizationEventsFacetsPerformanceHistogramEndpoint(
    OrganizationEventsFacetsPerformanceEndpointBase
):
    def has_feature(self, organization, request):
        return self.has_tag_page_feature(organization, request)

    def get(self, request, organization):
        try:
            params, aggregate_column, filter_query = self.setup(request, organization)
        except NoProjects:
            return Response([])

        tag_key = request.GET.get("tagKey")
        tag_key_limit = request.GET.get("tagKeyLimit")
        num_buckets_per_key = request.GET.get("numBucketsPerKey")

        if not tag_key_limit:
            raise ParseError(detail="'tagKeyLimit' must be provided for the performance histogram.")
        if not num_buckets_per_key:
            raise ParseError(
                detail="'numBucketsPerKey' must be provided for the performance histogram."
            )
        try:
            tag_key_limit = int(tag_key_limit)
            num_buckets_per_key = int(num_buckets_per_key)
        except ValueError:
            raise ParseError(detail="Bucket and tag key limits must be numeric.")

        if tag_key_limit * num_buckets_per_key > 500:
            raise ParseError(
                detail="The number of total buckets ('tagKeyLimit' * 'numBucketsPerKey') cannot exceed 500"
            )

        if not tag_key:
            raise ParseError(detail="'tagKey' must be provided when using histograms.")

        if tag_key in TAG_ALIASES:
            tag_key = TAG_ALIASES.get(tag_key)

        def data_fn():
            with sentry_sdk.start_span(op="discover.endpoint", description="discover_query"):
                referrer = "api.organization-events-facets-performance-histogram"
                top_tags = query_top_tags(
                    tag_key=tag_key,
                    limit=tag_key_limit,
                    filter_query=filter_query,
                    aggregate_column=aggregate_column,
                    params=params,
                    orderby=self.get_orderby(request),
                    referrer=referrer,
                )

                if not top_tags:
                    return {"data": []}, []

                results = query_facet_performance_key_histogram(
                    top_tags=top_tags,
                    tag_key=tag_key,
                    filter_query=filter_query,
                    aggregate_column=aggregate_column,
                    referrer=referrer,
                    params=params,
                    limit=tag_key_limit,
                    num_buckets_per_key=num_buckets_per_key,
                )

                if not results:
                    return {"data": []}, top_tags

                for row in results["data"]:
                    row["tags_value"] = tagstore.get_tag_value_label(
                        row["tags_key"], row["tags_value"]
                    )
                    row["tags_key"] = tagstore.get_standardized_key(row["tags_key"])

                return results, top_tags

        with self.handle_query_errors():
            results, top_tags = data_fn()
            return Response(
                {
                    "tags": self.handle_results_with_meta(
                        request, organization, params["project_id"], {"data": top_tags}
                    ),
                    "histogram": self.handle_results_with_meta(
                        request, organization, params["project_id"], results
                    ),
                }
            )


def query_tag_data(
    params: Mapping[str, str],
    referrer: str,
    filter_query: Optional[str] = None,
    aggregate_column: Optional[str] = None,
) -> Optional[Dict]:
    """
    Fetch general data about all the transactions with this transaction name to feed into the facet query
    :return: Returns the row with aggregate and count if the query was successful
             Returns None if query was not successful which causes the endpoint to return early
    """
    with sentry_sdk.start_span(
        op="discover.discover", description="facets.filter_transform"
    ) as span:
        span.set_data("query", filter_query)
        snuba_filter = get_filter(filter_query, params)

        # Resolve the public aliases into the discover dataset names.
        snuba_filter, translated_columns = discover.resolve_discover_aliases(snuba_filter)

    with sentry_sdk.start_span(op="discover.discover", description="facets.frequent_tags"):
        # Get the average and count to use to filter the next request to facets
        tag_data = discover.query(
            selected_columns=[
                "count()",
                f"avg({aggregate_column}) as aggregate",
                f"max({aggregate_column}) as max",
                f"min({aggregate_column}) as min",
            ],
            query=filter_query,
            params=params,
            orderby=["-count"],
            referrer=f"{referrer}.all_transactions",
            limit=1,
        )

        if len(tag_data["data"]) != 1:
            return None

        counts = [r["count"] for r in tag_data["data"]]
        aggregates = [r["aggregate"] for r in tag_data["data"]]

        # Return early to avoid doing more queries with 0 count transactions or aggregates for columns that don't exist
        if counts[0] == 0 or aggregates[0] is None:
            return None
    if not tag_data["data"][0]:
        return None
    return tag_data["data"][0]


def query_top_tags(
    params: Mapping[str, str],
    tag_key: str,
    limit: int,
    referrer: str,
    orderby: Optional[List[str]],
    aggregate_column: Optional[str] = None,
    filter_query: Optional[str] = None,
) -> Optional[List[Any]]:
    """
    Fetch counts by tag value, finding the top tag values for a tag key by a limit.
    :return: Returns the row with the value, the aggregate and the count if the query was successful
             Returns None if query was not successful which causes the endpoint to return early
    """
    with sentry_sdk.start_span(
        op="discover.discover", description="facets.filter_transform"
    ) as span:
        span.set_data("query", filter_query)
        snuba_filter = get_filter(filter_query, params)

        # Resolve the public aliases into the discover dataset names.
        snuba_filter, translated_columns = discover.resolve_discover_aliases(snuba_filter)

    translated_aggregate_column = discover.resolve_discover_column(aggregate_column)

    with sentry_sdk.start_span(op="discover.discover", description="facets.top_tags"):

        if not orderby:
            orderby = ["-count"]

        for i, sort in enumerate(orderby):
            if "frequency" in sort:
                # Replacing frequency as it's the same underlying data dimension, this way we don't have to modify the existing histogram query.
                orderby[i] = sort.replace("frequency", "count")

        # Get the average and count to use to filter the next request to facets
        tag_data = discover.query(
            selected_columns=[
                "count()",
                "array_join(tags.value) as tags_value",
            ],
            query=filter_query,
            params=params,
            orderby=orderby,
            conditions=[
                [translated_aggregate_column, "IS NOT NULL", None],
                ["tags_key", "IN", [tag_key]],
            ],
            functions_acl=["array_join"],
            referrer=f"{referrer}.top_tags",
            limit=limit,
        )

        if len(tag_data["data"]) <= 0:
            return None

        counts = [r["count"] for r in tag_data["data"]]

        # Return early to avoid doing more queries with 0 count transactions or aggregates for columns that don't exist
        if counts[0] == 0:
            return None
    if not tag_data["data"]:
        return None
    return tag_data["data"]


def query_facet_performance(
    params: Mapping[str, str],
    tag_data: Mapping[str, Any],
    referrer: str,
    aggregate_column: Optional[str] = None,
    filter_query: Optional[str] = None,
    orderby: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    all_tag_keys: Optional[bool] = None,
    tag_key: Optional[bool] = None,
) -> Dict:
    with sentry_sdk.start_span(
        op="discover.discover", description="facets.filter_transform"
    ) as span:
        span.set_data("query", filter_query)
        snuba_filter = get_filter(filter_query, params)

        # Resolve the public aliases into the discover dataset names.
        snuba_filter, translated_columns = discover.resolve_discover_aliases(snuba_filter)
    translated_aggregate_column = discover.resolve_discover_column(aggregate_column)

    # Aggregate (avg) and count of all transactions for this query
    transaction_aggregate = tag_data["aggregate"]

    # Dynamically sample so at least 50000 transactions are selected
    sample_start_count = 50000
    transaction_count = tag_data["count"]
    sampling_enabled = transaction_count > sample_start_count

    # log-e growth starting at 50,000
    target_sample = max(
        sample_start_count * (math.log(transaction_count) - (math.log(sample_start_count) - 1)),
        transaction_count,
    )

    dynamic_sample_rate = 0 if transaction_count <= 0 else (target_sample / transaction_count)
    sample_rate = min(max(dynamic_sample_rate, 0), 1) if sampling_enabled else None
    frequency_sample_rate = sample_rate if sample_rate else 1

    # Exclude tags that have high cardinality are are generally unrelated to performance
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
        if not all_tag_keys and not tag_key:
            having.append(["aggregate", ">", aggregate_comparison])

        resolved_orderby = [] if orderby is None else orderby

        conditions.append([translated_aggregate_column, "IS NOT NULL", None])

        if tag_key:
            conditions.append(["tags_key", "IN", [tag_key]])
        tag_key_limit = limit if tag_key else 1

        tag_selected_columns = [
            [
                "divide",
                [
                    ["sum", [["minus", [translated_aggregate_column, transaction_aggregate]]]],
                    frequency_sample_rate,
                ],
                "sumdelta",
            ],
            ["count", [], "count"],
            [
                "divide",
                [["divide", [["count", []], frequency_sample_rate]], transaction_count],
                "frequency",
            ],
            ["divide", ["aggregate", transaction_aggregate], "comparison"],
            ["avg", [translated_aggregate_column], "aggregate"],
        ]

        results = discover.raw_query(
            selected_columns=tag_selected_columns,
            conditions=conditions,
            start=snuba_filter.start,
            end=snuba_filter.end,
            filter_keys=snuba_filter.filter_keys,
            orderby=resolved_orderby + ["tags_key"],
            groupby=["tags_key", "tags_value"],
            having=having,
            dataset=Dataset.Discover,
            referrer=f"{referrer}.tag_values".format(referrer, "tag_values"),
            sample=sample_rate,
            turbo=sample_rate is not None,
            limitby=[tag_key_limit, "tags_key"],
            limit=limit,
            offset=offset,
        )

        results["meta"] = discover.transform_meta(results, {})

        return results


def query_facet_performance_key_histogram(
    params: Mapping[str, str],
    top_tags: List[Any],
    tag_key: str,
    num_buckets_per_key: int,
    limit: int,
    referrer: str,
    aggregate_column: Optional[str] = None,
    filter_query: Optional[str] = None,
) -> Dict:
    precision = 0

    tag_values = [x["tags_value"] for x in top_tags]

    num_buckets = num_buckets_per_key * limit

    results = discover.histogram_query(
        fields=[
            aggregate_column,
        ],
        user_query=filter_query,
        params=params,
        num_buckets=num_buckets,
        precision=precision,
        group_by=["tags_value", "tags_key"],
        limit_by=[num_buckets_per_key, "tags_value"],
        extra_conditions=[
            ["tags_key", "IN", [tag_key]],
            ["tags_value", "IN", tag_values],
        ],
        referrer="api.organization-events-facets-performance-histogram",
        normalize_results=False,
    )
    return results
