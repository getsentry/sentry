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
    AI_CONVERSATION_TOOL_BREAKDOWN_COLUMNS,
    AI_CONVERSATION_TOOL_BREAKDOWN_ORDERBY,
    AI_CONVERSATION_TRACE_COLUMNS,
    AI_CONVERSATION_USER_COLUMNS,
    ConversationMeta,
    parse_conversation_aggregates,
    parse_conversation_user,
    parse_tool_breakdown,
    parse_trace_ids,
    resolve_conversation_params,
)
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import TableQuery
from sentry.snuba.spans_rpc import Spans


@cell_silo_endpoint
class OrganizationAIConversationMetaEndpoint(OrganizationEventsEndpointBase):
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

        with handle_query_errors():
            resolved_params = resolve_conversation_params(
                request, snuba_params, conversation_id, now
            )
            return Response(self._fetch_meta(resolved_params, conversation_id))

    @sentry_sdk.trace
    def _fetch_meta(self, snuba_params: SnubaParams, conversation_id: str) -> ConversationMeta:
        conversation_filter = build_escaped_term_filter("gen_ai.conversation.id", [conversation_id])
        resolver = Spans.get_resolver(snuba_params, SearchResolverConfig(auto_fields=True))

        # Bounded aggregate queries over the conversation, batched into one RPC. No raw-span
        # scan: the numbers and user ride on one grouped row, traces are a group-by, and the
        # tool breakdown is per-tool — so this stays lightweight and independent of listing
        # every span (which the paginated details endpoint does).
        results = Spans.run_bulk_table_queries(
            [
                TableQuery(
                    name="aggregation",
                    query_string=conversation_filter,
                    selected_columns=[
                        "gen_ai.conversation.id",
                        *AI_CONVERSATION_AGGREGATION_COLUMNS,
                        *AI_CONVERSATION_USER_COLUMNS,
                    ],
                    orderby=None,
                    offset=0,
                    limit=1,
                    referrer=Referrer.API_AI_CONVERSATION_META.value,
                    sampling_mode="HIGHEST_ACCURACY",
                    resolver=resolver,
                ),
                TableQuery(
                    name="traces",
                    query_string=conversation_filter,
                    selected_columns=AI_CONVERSATION_TRACE_COLUMNS,
                    orderby=None,
                    offset=0,
                    limit=10000,
                    referrer=Referrer.API_AI_CONVERSATION_META.value,
                    sampling_mode="HIGHEST_ACCURACY",
                    resolver=resolver,
                ),
                TableQuery(
                    name="tool_breakdown",
                    query_string=f"{conversation_filter} gen_ai.operation.type:tool",
                    selected_columns=AI_CONVERSATION_TOOL_BREAKDOWN_COLUMNS,
                    orderby=AI_CONVERSATION_TOOL_BREAKDOWN_ORDERBY,
                    offset=0,
                    limit=50,
                    referrer=Referrer.API_AI_CONVERSATION_META.value,
                    sampling_mode="HIGHEST_ACCURACY",
                    resolver=resolver,
                ),
            ]
        )

        aggregation_rows = results["aggregation"].get("data", [])
        aggregation_row = aggregation_rows[0] if aggregation_rows else {}

        return {
            **parse_conversation_aggregates(aggregation_row),
            "user": parse_conversation_user(aggregation_row),
            "tools": parse_tool_breakdown(results["tool_breakdown"].get("data", [])),
            "traceIds": parse_trace_ids(results["traces"].get("data", [])),
        }
