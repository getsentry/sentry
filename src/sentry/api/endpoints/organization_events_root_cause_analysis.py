from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import sentry_sdk
from rest_framework.response import Response
from snuba_sdk import And, Column, Condition, Function, LimitBy, Op

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_events import OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_events_spans_performance import EventID, get_span_description
from sentry.api.helpers.span_analysis import span_analysis
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.constants import METRICS_MAX_LIMIT
from sentry.search.events.types import QueryBuilderConfig
from sentry.search.utils import parse_datetime_string
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics_performance import query as metrics_query
from sentry.utils.snuba import raw_snql_query

DEFAULT_LIMIT = 50
QUERY_LIMIT = 10000 // 2
BUFFER = timedelta(hours=6)
BASE_REFERRER = "api.organization-events-root-cause-analysis"
SPAN_ANALYSIS = "span"
GEO_ANALYSIS = "geo"

_query_thread_pool = ThreadPoolExecutor()


def init_query_builder(params, transaction, regression_breakpoint, type):
    selected_columns = [
        "count(span_id) as span_count",
        "percentileArray(spans_exclusive_time, 0.95) as p95_self_time",
        "array_join(spans_op) as span_op",
        "array_join(spans_group) as span_group",
    ]

    builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        selected_columns=selected_columns,
        equations=[],
        query=f"transaction:{transaction}",
        orderby=["span_op", "span_group", "p95_self_time"],
        limit=QUERY_LIMIT,
        config=QueryBuilderConfig(
            auto_aggregations=True,
            use_aggregate_conditions=True,
            functions_acl=[
                "array_join",
                "sumArray",
                "percentileArray",
            ],
        ),
    )

    builder.columns.append(
        Function(
            "if",
            [
                Function("greaterOrEquals", [Column("timestamp"), regression_breakpoint]),
                "after",
                "before",
            ],
            "period",
        )
    )
    builder.columns.append(Function("countDistinct", [Column("event_id")], "transaction_count"))
    builder.groupby.append(Column("period"))
    builder.limitby = LimitBy([Column("period")], QUERY_LIMIT)

    # Filter out timestamp because we want to control the timerange for parallelization
    builder.where = [
        condition for condition in builder.where if condition.lhs != Column("timestamp")
    ]
    if type == "before":
        builder.where += [
            Condition(Column("timestamp"), Op.GTE, params.get("start")),
            Condition(Column("timestamp"), Op.LT, regression_breakpoint - BUFFER),
        ]
    else:
        builder.where += [
            Condition(Column("timestamp"), Op.GTE, regression_breakpoint + BUFFER),
            Condition(Column("timestamp"), Op.LT, params.get("end")),
        ]

    return builder


def get_parallelized_snql_queries(transaction, regression_breakpoint, params):
    return [
        init_query_builder(params, transaction, regression_breakpoint, "before").get_snql_query(),
        init_query_builder(params, transaction, regression_breakpoint, "after").get_snql_query(),
    ]


def query_spans(transaction, regression_breakpoint, params):
    referrer = f"{BASE_REFERRER}-{SPAN_ANALYSIS}"
    snql_queries = get_parallelized_snql_queries(transaction, regression_breakpoint, params)

    # Parallelize the request for span data
    snuba_results = list(_query_thread_pool.map(raw_snql_query, snql_queries, [referrer, referrer]))
    span_results = []

    # append all the results
    for result in snuba_results:
        output_dict = result["data"]
        span_results += output_dict

    return span_results


def fetch_sample_event_ids(span_analysis_results, params, transaction):
    builder = QueryBuilder(
        dataset=Dataset.Transactions,
        params=params,
        selected_columns=[
            "any(id) as sample_event_id",
            "array_join(spans_op) as span_op",
            "array_join(spans_group) as span_group",
        ],
        equations=[],
        query=f"transaction:{transaction}",
        limit=QUERY_LIMIT,
        config=QueryBuilderConfig(
            auto_aggregations=True,
            use_aggregate_conditions=True,
            functions_acl=[
                "array_join",
                "sumArray",
                "percentileArray",
            ],
        ),
    )

    conditions = []
    for result in span_analysis_results:
        conditions.append(
            And(
                [
                    Condition(Column("span_op"), Op.EQ, result["span_op"]),
                    Condition(Column("span_group"), Op.EQ, result["span_group"]),
                ]
            )
        )

    builder.add_conditions(conditions)

    return raw_snql_query(builder.get_snql_query(), f"{BASE_REFERRER}-fetch-sample-ids").get(
        "data", []
    )


def fetch_span_analysis_results(transaction_name, regression_breakpoint, params, project_id, limit):
    span_data = query_spans(
        transaction=transaction_name,
        regression_breakpoint=regression_breakpoint,
        params=params,
    )

    span_analysis_results = span_analysis(span_data)[:limit]

    relevant_sample_events = fetch_sample_event_ids(span_analysis_results, params, transaction_name)
    keyed_relevant_sample_events = {
        f'{result["span_op"]},{result["span_group"]}': result["sample_event_id"]
        for result in relevant_sample_events
    }

    for result in span_analysis_results:
        result["sample_event_id"] = keyed_relevant_sample_events[
            f'{result["span_op"]},{result["span_group"]}'
        ]

    for result in span_analysis_results:
        result["span_description"] = get_span_description(
            EventID(project_id, result["sample_event_id"]),
            result["span_op"],
            result["span_group"],
        )

    return span_analysis_results


def fetch_geo_analysis_results(transaction_name, regression_breakpoint, params, limit):
    def get_geo_data(period):
        # Copy the params so we aren't modifying the base params each time
        adjusted_params = {**params}

        if period == "before":
            adjusted_params["end"] = regression_breakpoint - BUFFER
        else:
            adjusted_params["start"] = regression_breakpoint + BUFFER

        geo_code_durations = metrics_query(
            ["p95(transaction.duration)", "geo.country_code", "tpm()"],
            f"event.type:transaction transaction:{transaction_name}",
            adjusted_params,
            referrer=f"{BASE_REFERRER}-{GEO_ANALYSIS}",
            limit=METRICS_MAX_LIMIT,
            # Order by descending TPM to ensure more active countries are prioritized
            orderby=["-tpm()"],
        )

        return geo_code_durations

    # For each country code in the second half, compare it to the first half
    geo_results = [get_geo_data("before"), get_geo_data("after")]

    # Format the data for more efficient comparison
    for index, result in enumerate(geo_results):
        geo_results[index] = {
            f"{data.get('geo.country_code')}": data for data in result.get("data")
        }

    before_results, after_results = geo_results
    changed_keys = set(before_results.keys()) & set(after_results.keys())
    new_keys = set(after_results.keys()) - set(before_results.keys())

    analysis_results = []
    for key in changed_keys | new_keys:
        if key == "":
            continue

        duration_before = (
            before_results[key]["p95_transaction_duration"] if before_results.get(key) else 0.0
        )
        duration_after = after_results[key]["p95_transaction_duration"]
        if duration_after > duration_before:
            duration_delta = duration_after - duration_before
            analysis_results.append(
                {
                    "geo.country_code": key,
                    "duration_before": duration_before,
                    "duration_after": duration_after,
                    "duration_delta": duration_delta,
                    # Multiply duration delta by current TPM to prioritize largest changes
                    # by most active countries
                    "score": duration_delta * after_results[key]["tpm"],
                }
            )

    analysis_results.sort(key=lambda x: x["score"], reverse=True)
    return analysis_results[:limit]


@region_silo_endpoint
class OrganizationEventsRootCauseAnalysisEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request, organization):
        if not features.has(
            "organizations:performance-duration-regression-visible",
            organization,
            actor=request.user,
        ):
            return Response(status=404)

        # TODO: Extract this into a custom serializer to handle validation
        transaction_name = request.GET.get("transaction")
        project_id = request.GET.get("project")
        regression_breakpoint = request.GET.get("breakpoint")
        analysis_type = request.GET.get("type", SPAN_ANALYSIS)
        limit = int(request.GET.get("per_page", DEFAULT_LIMIT))
        if not transaction_name or not project_id or not regression_breakpoint:
            # Project ID is required to ensure the events we query for are
            # the same transaction
            return Response(status=400)

        regression_breakpoint = parse_datetime_string(regression_breakpoint)

        params = self.get_snuba_params(request, organization)

        with self.handle_query_errors():
            transaction_count_query = metrics_query(
                ["count()"],
                f"event.type:transaction transaction:{transaction_name}",
                params,
                referrer=f"{BASE_REFERRER}-{analysis_type}",
            )

        if transaction_count_query["data"][0]["count"] == 0:
            return Response(status=400, data="Transaction not found")

        sentry_sdk.set_tag("analysis_type", analysis_type)
        results = []
        if analysis_type == SPAN_ANALYSIS:
            results = fetch_span_analysis_results(
                transaction_name, regression_breakpoint, params, project_id, limit
            )
        elif analysis_type == GEO_ANALYSIS:
            results = fetch_geo_analysis_results(
                transaction_name, regression_breakpoint, params, limit
            )

        return Response(results, status=200)
