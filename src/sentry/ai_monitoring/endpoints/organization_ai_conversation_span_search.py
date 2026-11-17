from typing import TypedDict

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import AnyAttributeFilter, TraceItemFilter

from sentry import features
from sentry.ai_monitoring.utils import get_time_range_error, resolve_conversation_time_window
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.utils import handle_query_errors
from sentry.apidocs.response_types import DetailResponse
from sentry.models.organization import Organization
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import TableQuery
from sentry.snuba.spans_rpc import Spans

MAX_QUERY_LENGTH = 256
# The conversation details endpoint's largest page.
MAX_MATCHES = 1000

GEN_AI_SPANS_FILTER = "(has:gen_ai.operation.type OR span.op:gen_ai.* OR span.name:gen_ai.*)"


class AIConversationSpanMatch(TypedDict):
    traceId: str
    spanId: str
    startTimestamp: float


class AIConversationSpanSearchResponse(TypedDict):
    matches: list[AIConversationSpanMatch]
    total: int


def _substring_pattern(query: str) -> str:
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


@cell_silo_endpoint
class OrganizationAIConversationSpanSearchEndpoint(OrganizationEventsEndpointBase):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.AGENT_TRACING

    def get(
        self, request: Request, organization: Organization, conversation_id: str
    ) -> Response[AIConversationSpanSearchResponse] | Response[DetailResponse] | Response[None]:
        if not features.has(
            "organizations:gen-ai-conversation-transcript-search",
            organization,
            actor=request.user,
        ):
            return Response(status=404)

        query = request.GET.get("query", "").strip()
        if not query:
            return Response(DetailResponse(detail="query is required"), status=400)
        if len(query) > MAX_QUERY_LENGTH:
            return Response(
                DetailResponse(detail=f"query can be at most {MAX_QUERY_LENGTH} characters"),
                status=400,
            )

        # Keep this preamble in step with OrganizationAIConversationDetailsEndpoint, so the
        # match is on the pages that endpoint returns.
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        now = timezone.now()
        if time_range_error := get_time_range_error(request, snuba_params, now):
            return Response(DetailResponse(detail=time_range_error), status=400)
        has_explicit_range = request.GET.get("start") or request.GET.get("end")

        with handle_query_errors():
            if has_explicit_range:
                resolved_params = snuba_params
            else:
                resolved_params = resolve_conversation_time_window(
                    snuba_params,
                    request.GET.get("statsPeriod"),
                    now,
                    conversation_id,
                    Referrer.API_AI_CONVERSATION_SPAN_SEARCH.value,
                )

            query_string = (
                f"{build_escaped_term_filter('gen_ai.conversation.id', [conversation_id])} "
                f"{GEN_AI_SPANS_FILTER}"
            )
            resolver = Spans.get_resolver(
                resolved_params,
                SearchResolverConfig(auto_fields=False, disable_aggregate_extrapolation=True),
            )
            extra_conditions = TraceItemFilter(
                any_attribute_filter=AnyAttributeFilter(
                    op=AnyAttributeFilter.OP_LIKE,
                    value=AttributeValue(val_str=_substring_pattern(query)),
                    ignore_case=True,
                )
            )
            results = Spans.run_bulk_table_queries(
                [
                    TableQuery(
                        name="matches",
                        query_string=query_string,
                        selected_columns=["span_id", "trace", "precise.start_ts"],
                        orderby=["precise.start_ts", "span_id"],
                        offset=0,
                        limit=MAX_MATCHES,
                        referrer=Referrer.API_AI_CONVERSATION_SPAN_SEARCH.value,
                        sampling_mode="HIGHEST_ACCURACY",
                        resolver=resolver,
                        extra_conditions=extra_conditions,
                    ),
                    TableQuery(
                        name="total",
                        query_string=query_string,
                        selected_columns=["count()"],
                        orderby=None,
                        offset=0,
                        limit=1,
                        referrer=Referrer.API_AI_CONVERSATION_SPAN_SEARCH.value,
                        sampling_mode="HIGHEST_ACCURACY",
                        resolver=resolver,
                        extra_conditions=extra_conditions,
                    ),
                ]
            )

        total_rows = results["total"].get("data", [])
        return Response(
            {
                "matches": [
                    {
                        "traceId": row["trace"],
                        "spanId": row["span_id"],
                        "startTimestamp": row["precise.start_ts"],
                    }
                    for row in results["matches"].get("data", [])
                ],
                "total": int(total_rows[0]["count()"]) if total_rows else 0,
            }
        )
