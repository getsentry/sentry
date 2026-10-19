from datetime import timedelta
from typing import TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Direction, Function, Op, Or, OrderBy

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization_events import OrganizationEventsEndpointBase
from sentry.api.endpoints.organization_events_spans_performance import EventID, get_span_description
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.types import QueryBuilderConfig
from sentry.search.utils import InvalidQuery, parse_datetime_string
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics_performance import query as metrics_query
from sentry.utils.snuba import raw_snql_query

DEFAULT_LIMIT = 50
MAX_LIMIT = 100
BUFFER = timedelta(hours=6)
BASE_REFERRER = "api.organization-events-root-cause-analysis"
SPAN_ANALYSIS_SCORE_THRESHOLD = 0


class RootCauseAnalysisSpanResponse(TypedDict):
    span_op: str
    span_group: str
    span_description: str | None
    spm_before: float
    spm_after: float
    p95_before: float
    p95_after: float
    score: float


class RootCauseAnalysisQuerySerializer(serializers.Serializer):
    transaction = serializers.CharField(max_length=200)
    project = ProjectField(scope="project:read", id_allowed=True)
    breakpoint = serializers.CharField()
    per_page = serializers.IntegerField(min_value=1, max_value=MAX_LIMIT, default=DEFAULT_LIMIT)
    span_score_threshold = serializers.IntegerField(
        min_value=0, default=SPAN_ANALYSIS_SCORE_THRESHOLD
    )

    def validate_transaction(self, value):
        # Restrict to characters that are safe for downstream query construction.
        if '"' in value or "\\" in value:
            raise serializers.ValidationError(
                "Transaction name cannot contain quote or backslash characters."
            )
        return value

    def validate_breakpoint(self, value):
        try:
            return parse_datetime_string(value)
        except InvalidQuery:
            raise serializers.ValidationError("Must be an ISO 8601 datetime or unix timestamp.")


def init_query_builder(
    snuba_params, transaction, regression_breakpoint, limit, span_score_threshold
):
    before_minutes = int((regression_breakpoint - snuba_params.start).total_seconds() // 60)
    after_minutes = int((snuba_params.end - regression_breakpoint).total_seconds() // 60)

    selected_columns = [
        "percentileArray(spans_exclusive_time, 0.95) as p95_self_time",
        "array_join(spans_op) as span_op",
        "array_join(spans_group) as span_group",
        # want a single event id to fetch from nodestore for the span description
        "any(id) as sample_event_id",
    ]

    builder = DiscoverQueryBuilder(
        dataset=Dataset.Discover,
        params={},
        snuba_params=snuba_params,
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


def query_spans(transaction, regression_breakpoint, snuba_params, limit, span_score_threshold):
    snuba_results = raw_snql_query(
        init_query_builder(
            snuba_params, transaction, regression_breakpoint, limit, span_score_threshold
        ).get_snql_query(),
        BASE_REFERRER,
    )
    return snuba_results.get("data")


def fetch_span_analysis_results(
    transaction_name, regression_breakpoint, snuba_params, project_id, limit, span_score_threshold
) -> list[RootCauseAnalysisSpanResponse]:
    span_data = query_spans(
        transaction=transaction_name,
        regression_breakpoint=regression_breakpoint,
        snuba_params=snuba_params,
        limit=limit,
        span_score_threshold=span_score_threshold,
    )

    for result in span_data:
        result["span_description"] = get_span_description(
            EventID(project_id, result["sample_event_id"]),
            result["span_op"],
            result["span_group"],
        )

    return [
        {
            "span_op": row["span_op"],
            "span_group": row["span_group"],
            "span_description": row["span_description"],
            "spm_before": row["spm_before"],
            "spm_after": row["spm_after"],
            "p95_before": row["p95_before"],
            "p95_after": row["p95_after"],
            "score": row["score"],
        }
        for row in span_data
    ]


@extend_schema(tags=["Discover"])
@cell_silo_endpoint
class OrganizationEventsRootCauseAnalysisEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="listOrganizationEventsRootCauseAnalysis",
        summary="List Spans Contributing to a Transaction Regression",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="project",
                location="query",
                required=True,
                type=str,
                description="The ID or slug of the project the transaction belongs to.",
            ),
            OpenApiParameter(
                name="transaction",
                location="query",
                required=True,
                type=str,
                description="The name of the regressed transaction.",
            ),
            OpenApiParameter(
                name="breakpoint",
                location="query",
                required=True,
                type=str,
                description="When the regression started, as an ISO 8601 datetime or a Unix timestamp.",
            ),
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            OpenApiParameter(
                name="per_page",
                location="query",
                required=False,
                type=int,
                description=f"The number of spans to return. Defaults to {DEFAULT_LIMIT}, maximum is {MAX_LIMIT}.",
            ),
            OpenApiParameter(
                name="span_score_threshold",
                location="query",
                required=False,
                type=int,
                description=f"Only return spans with at least this score. Defaults to {SPAN_ANALYSIS_SCORE_THRESHOLD}.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEventsRootCauseAnalysisResponse",
                list[RootCauseAnalysisSpanResponse],
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> (
        Response[list[RootCauseAnalysisSpanResponse]]
        | Response[ValidationErrorResponse]
        | Response[str]
    ):
        """
        Return the spans in a transaction that contributed most to a performance
        regression, comparing their throughput (`spm`) and p95 self time before and after
        the breakpoint. Spans are ordered by `score`, the increase in total time spent.
        """
        serializer = RootCauseAnalysisQuerySerializer(
            data=request.GET,
            context={"access": request.access, "organization": organization},
        )
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        validated = serializer.validated_data
        transaction_name = validated["transaction"]
        project_id = validated["project"].id
        regression_breakpoint = validated["breakpoint"]
        limit = validated["per_page"]
        span_score_threshold = validated["span_score_threshold"]

        snuba_params = self.get_snuba_params(request, organization)

        with handle_query_errors():
            transaction_count_query = metrics_query(
                ["count()"],
                f'event.type:transaction transaction:"{transaction_name}"',
                referrer=BASE_REFERRER,
                snuba_params=snuba_params,
            )

        if transaction_count_query["data"][0]["count"] == 0:
            return Response(status=400, data="Transaction not found")

        results = fetch_span_analysis_results(
            transaction_name,
            regression_breakpoint,
            snuba_params,
            project_id,
            limit,
            span_score_threshold,
        )

        return Response(results, status=200)
