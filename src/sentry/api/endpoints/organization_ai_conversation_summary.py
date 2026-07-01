import sentry_sdk
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.helpers.ai_conversations import (
    AI_CONVERSATION_AGGREGATION_COLUMNS,
    AI_CONVERSATION_ENRICHMENT_COLUMNS,
    ConversationSummary,
    build_tool_summaries,
    extract_conversation_enrichment,
    parse_conversation_aggregates,
    resolve_conversation_time_window,
    retention_window_error,
)
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans


@cell_silo_endpoint
class OrganizationAIConversationSummaryEndpoint(OrganizationEventsEndpointBase):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def get(self, request: Request, organization: Organization, conversation_id: str) -> Response:
        if not features.has("organizations:gen-ai-conversations", organization, actor=request.user):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        now = timezone.now()
        has_explicit_range = request.GET.get("start") or request.GET.get("end")

        if has_explicit_range:
            error = retention_window_error(snuba_params, now)
            if error:
                return Response({"detail": error}, status=400)

        with handle_query_errors():
            if has_explicit_range:
                resolved_params = snuba_params
            else:
                resolved_params = resolve_conversation_time_window(
                    snuba_params, request.GET.get("statsPeriod"), now, conversation_id
                )

            return Response(self._fetch_summary(resolved_params, conversation_id))

    @sentry_sdk.trace
    def _fetch_summary(
        self, snuba_params: SnubaParams, conversation_id: str
    ) -> ConversationSummary:
        conversation_filter = build_escaped_term_filter("gen_ai.conversation.id", [conversation_id])

        aggregation = Spans.run_table_query(
            params=snuba_params,
            query_string=conversation_filter,
            selected_columns=["gen_ai.conversation.id", *AI_CONVERSATION_AGGREGATION_COLUMNS],
            orderby=None,
            offset=0,
            limit=1,
            referrer=Referrer.API_AI_CONVERSATION_SUMMARY.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode="HIGHEST_ACCURACY",
        )
        enrichment = Spans.run_table_query(
            params=snuba_params,
            query_string=f"{conversation_filter} has:gen_ai.operation.type",
            selected_columns=[*AI_CONVERSATION_ENRICHMENT_COLUMNS],
            orderby=["timestamp"],
            offset=0,
            limit=10000,
            referrer=Referrer.API_AI_CONVERSATION_SUMMARY.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode="HIGHEST_ACCURACY",
        )

        aggregation_rows = aggregation.get("data", [])
        aggregates = parse_conversation_aggregates(aggregation_rows[0] if aggregation_rows else {})
        extracted = extract_conversation_enrichment(enrichment.get("data", []))

        return {
            "errors": aggregates["errors"],
            "llmCalls": aggregates["llmCalls"],
            "toolCalls": aggregates["toolCalls"],
            "totalTokens": aggregates["totalTokens"],
            "inputTokens": aggregates["inputTokens"],
            "outputTokens": aggregates["outputTokens"],
            "totalCost": aggregates["totalCost"],
            "user": extracted["user"],
            "tools": build_tool_summaries(extracted),
        }
