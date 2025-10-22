from collections import defaultdict

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsV2EndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans


class OrganizationAIConversationsSerializer(serializers.Serializer):
    """Serializer for validating query parameters."""

    sort = serializers.CharField(required=False, default="-timestamp")
    query = serializers.CharField(required=False, allow_blank=True)

    def validate_sort(self, value):
        allowed_sorts = {
            "timestamp",
            "-timestamp",
            "duration",
            "-duration",
            "errors",
            "-errors",
            "llmCalls",
            "-llmCalls",
            "toolCalls",
            "-toolCalls",
            "totalTokens",
            "-totalTokens",
            "totalCost",
            "-totalCost",
        }
        if value not in allowed_sorts:
            raise serializers.ValidationError(f"Invalid sort option: {value}")
        return value


@region_silo_endpoint
class OrganizationAIConversationsEndpoint(OrganizationEventsV2EndpointBase):
    """Endpoint for fetching AI agent conversation traces."""

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.VISIBILITY

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Retrieve AI conversation traces for an organization.
        """
        if not features.has("organizations:gen-ai-conversations", organization, actor=request.user):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        serializer = OrganizationAIConversationsSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated_data = serializer.validated_data

        # Create paginator with data function
        def data_fn(offset: int, limit: int):
            return self._get_conversations(
                snuba_params=snuba_params,
                offset=offset,
                limit=limit,
                _sort=validated_data.get("sort", "-timestamp"),
                _query=validated_data.get("query", ""),
            )

        with handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=lambda results: results,
            )

    def _get_conversations(
        self, snuba_params, offset: int, limit: int, _sort: str, _query: str
    ) -> list[dict]:
        """
        Fetch conversation data by querying spans grouped by gen_ai.conversation.id.

        Args:
            snuba_params: Snuba parameters including projects, time range, etc.
            offset: Starting index for pagination
            limit: Number of results to return
            _sort: Sort field and direction (currently only supports timestamp sorting, unused for now)
            _query: Search query (not yet implemented)
        """
        # Query spans grouped by conversation ID with aggregations
        results = Spans.run_table_query(
            params=snuba_params,
            query_string="has:gen_ai.conversation.id",
            selected_columns=[
                "gen_ai.conversation.id",
                "failure_count()",
                "count_if(gen_ai.operation.type,equals,ai_client)",
                "count_if(span.op,equals,gen_ai.execute_tool)",
                "sum(gen_ai.usage.total_tokens)",
                "sum(gen_ai.usage.total_cost)",
                "max(timestamp)",
                "min(precise.start_ts)",
                "max(precise.finish_ts)",
                "count_unique(trace)",
                "array_join(trace)",
            ],
            orderby=["-max(timestamp)"],
            offset=offset,
            limit=limit,
            referrer=Referrer.API_AI_CONVERSATIONS.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode=None,
        )

        # Format results to match frontend expectations
        conversations = []
        for row in results.get("data", []):
            start_ts = row.get("min(precise.start_ts)", 0)
            finish_ts = row.get("max(precise.finish_ts)", 0)
            duration_ms = int((finish_ts - start_ts) * 1000) if finish_ts and start_ts else 0

            timestamp_seconds = row.get("max(timestamp)", 0)
            timestamp_ms = int(timestamp_seconds * 1000) if timestamp_seconds else 0

            # Extract trace IDs from array_join result
            trace_ids_raw = row.get("array_join(trace)", [])
            trace_ids = trace_ids_raw if isinstance(trace_ids_raw, list) else []

            conversation = {
                "conversationId": row.get("gen_ai.conversation.id", ""),
                "flow": [],
                "duration": duration_ms,
                "errors": int(row.get("failure_count()", 0)),
                "llmCalls": int(row.get("count_if(gen_ai.operation.type,equals,ai_client)", 0)),
                "toolCalls": int(row.get("count_if(span.op,equals,gen_ai.execute_tool)", 0)),
                "totalTokens": int(row.get("sum(gen_ai.usage.total_tokens)", 0)),
                "totalCost": float(row.get("sum(gen_ai.usage.total_cost)", 0)),
                "timestamp": timestamp_ms,
                "traceCount": int(row.get("count_unique(trace)", 0)),
                "traceIds": trace_ids,
            }
            conversations.append(conversation)

        if conversations:
            self._enrich_with_agent_flows(snuba_params, conversations)

        return conversations

    def _enrich_with_agent_flows(self, snuba_params, conversations: list[dict]) -> None:
        """
        Enrich conversations with flow information by querying agent spans.
        Flow is an ordered array of agent names (from gen_ai.invoke_agent spans).
        """
        conversation_ids = [conv["conversationId"] for conv in conversations]

        agent_spans_results = Spans.run_table_query(
            params=snuba_params,
            query_string=f"span.op:gen_ai.invoke_agent gen_ai.conversation.id:[{','.join(conversation_ids)}]",
            selected_columns=[
                "gen_ai.conversation.id",
                "span.description",
                "timestamp",
            ],
            orderby=["gen_ai.conversation.id", "timestamp"],
            offset=0,
            limit=1000,
            referrer=Referrer.API_AI_CONVERSATIONS_AGENT_FLOWS.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode=None,
        )

        flows_by_conversation = defaultdict(list)
        for row in agent_spans_results.get("data", []):
            conv_id = row.get("gen_ai.conversation.id", "")
            agent_name = row.get("span.description", "")
            if conv_id and agent_name:
                flows_by_conversation[conv_id].append(agent_name)

        for conversation in conversations:
            conv_id = conversation["conversationId"]
            conversation["flow"] = flows_by_conversation.get(conv_id, [])
