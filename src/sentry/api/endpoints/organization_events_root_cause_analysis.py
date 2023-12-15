from datetime import timedelta

import sentry_sdk
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Direction, Function, Op, Or, OrderBy

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization_events import OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_events_spans_performance import EventID, get_span_description
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
SPAN_ANALYSIS_SCORE_THRESHOLD = 0
RESPONSE_KEYS = [
    "span_op",
    "span_group",
    "span_description",
    "spm_before",
    "spm_after",
    "p95_before",
    "p95_after",
    "score",
]


def init_query_builder(params, transaction, regression_breakpoint, limit, span_score_threshold):
    before_minutes = int((regression_breakpoint - params["start"]).total_seconds() // 60)
    after_minutes = int((params["end"] - regression_breakpoint).total_seconds() // 60)

    selected_columns = [
        "percentileArray(spans_exclusive_time, 0.95) as p95_self_time",
        "array_join(spans_op) as span_op",
        "array_join(spans_group) as span_group",
        # want a single event id to fetch from nodestore for the span description
        "any(id) as sample_event_id",
    ]

    builder = QueryBuilder(
        dataset=Dataset.Discover,
        params=params,
        selected_columns=selected_columns,
        equations=[],
        query=f'event.type:transaction transaction:"{transaction}"',
        limit=limit,
        config=QueryBuilderConfig(
            auto_aggregations=True,
            use_aggregate_conditions=True,
            functions_acl=[
                "array_join",
                "percentileArray",
            ],
        ),
    )

    p95_before_function = Function(
        "quantileIf(0.95)",
        [
            Function("arrayJoin", [Column("spans.exclusive_time")]),
            Function("less", [Column("timestamp"), regression_breakpoint]),
        ],
    )
    builder.columns.append(
        Function(
            "if", [Function("isNaN", [p95_before_function]), 0, p95_before_function], "p95_before"
        )
    )
    p95_after_function = Function(
        "quantileIf(0.95)",
        [
            Function("arrayJoin", [Column("spans.exclusive_time")]),
            Function("greater", [Column("timestamp"), regression_breakpoint]),
        ],
    )
    builder.columns.append(
        Function(
            "if", [Function("isNaN", [p95_after_function]), 0, p95_after_function], "p95_after"
        )
    )
    builder.columns.append(
        Function(
            "divide",
            [
                Function(
                    "countIf", [Function("less", [Column("timestamp"), regression_breakpoint])]
                ),
                before_minutes,
            ],
            "spm_before",
        )
    )
    builder.columns.append(
        Function(
            "divide",
            [
                Function(
                    "countIf", [Function("greater", [Column("timestamp"), regression_breakpoint])]
                ),
                after_minutes,
            ],
            "spm_after",
        )
    )

    builder.columns.append(
        Function(
            "minus",
            [
                Function("multiply", [Column("spm_after"), Column("p95_after")]),
                Function("multiply", [Column("spm_before"), Column("p95_before")]),
            ],
            "score",
        )
    )

    builder.where.append(
        Or(
            [
                Condition(Column("timestamp"), Op.LT, regression_breakpoint - BUFFER),
                Condition(Column("timestamp"), Op.GT, regression_breakpoint + BUFFER),
            ]
        )
    )

    builder.having.append(Condition(Column("score"), Op.GTE, span_score_threshold))

    builder.orderby = [OrderBy(Column("score"), Direction.DESC)]

    return builder


def query_spans(transaction, regression_breakpoint, params, limit, span_score_threshold):
    referrer = f"{BASE_REFERRER}-{SPAN_ANALYSIS}"

    snuba_results = raw_snql_query(
        init_query_builder(
            params, transaction, regression_breakpoint, limit, span_score_threshold
        ).get_snql_query(),
        referrer,
    )
    return snuba_results.get("data")


def fetch_span_analysis_results(
    transaction_name, regression_breakpoint, params, project_id, limit, span_score_threshold
):
    span_data = query_spans(
        transaction=transaction_name,
        regression_breakpoint=regression_breakpoint,
        params=params,
        limit=limit,
        span_score_threshold=span_score_threshold,
    )

    for result in span_data:
        result["span_description"] = get_span_description(
            EventID(project_id, result["sample_event_id"]),
            result["span_op"],
            result["span_group"],
        )

    return [{key: row[key] for key in RESPONSE_KEYS} for row in span_data]


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
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request, organization):
        # TODO: Extract this into a custom serializer to handle validation
        transaction_name = request.GET.get("transaction")
        project_id = request.GET.get("project")
        regression_breakpoint = request.GET.get("breakpoint")
        analysis_type = request.GET.get("type", SPAN_ANALYSIS)
        limit = int(request.GET.get("per_page", DEFAULT_LIMIT))
        span_score_threshold = int(
            request.GET.get("span_score_threshold", SPAN_ANALYSIS_SCORE_THRESHOLD)
        )
        if not transaction_name or not project_id or not regression_breakpoint:
            # Project ID is required to ensure the events we query for are
            # the same transaction
            return Response(status=400)

        regression_breakpoint = parse_datetime_string(regression_breakpoint)

        params = self.get_snuba_params(request, organization)

        with self.handle_query_errors():
            transaction_count_query = metrics_query(
                ["count()"],
                f'event.type:transaction transaction:"{transaction_name}"',
                params,
                referrer=f"{BASE_REFERRER}-{analysis_type}",
            )

        if transaction_count_query["data"][0]["count"] == 0:
            return Response(status=400, data="Transaction not found")

        sentry_sdk.set_tag("analysis_type", analysis_type)
        results = []
        if analysis_type == SPAN_ANALYSIS:
            results = fetch_span_analysis_results(
                transaction_name,
                regression_breakpoint,
                params,
                project_id,
                limit,
                span_score_threshold,
            )
        elif analysis_type == GEO_ANALYSIS:
            results = fetch_geo_analysis_results(
                transaction_name, regression_breakpoint, params, limit
            )

        return Response(results, status=200)
