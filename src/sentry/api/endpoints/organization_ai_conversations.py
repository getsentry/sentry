import json  # noqa: S003
import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from typing import Any, cast

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

logger = logging.getLogger("sentry.api.endpoints.organization_ai_conversations")


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
    owner = ApiOwner.DATA_BROWSING

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
                default_per_page=10,
                max_per_page=100,
            )

    def _get_conversations(
        self, snuba_params, offset: int, limit: int, _sort: str, _query: str
    ) -> list[dict]:
        """
        Fetch conversation data by querying spans grouped by gen_ai.conversation.id.

        This is a two-step process:
        1. Find conversation IDs that have spans in the time range (with pagination/sorting)
        2. Get complete aggregations for those conversations (all spans, ignoring time filter)

        Args:
            snuba_params: Snuba parameters including projects, time range, etc.
            offset: Starting index for pagination
            limit: Number of results to return
            _sort: Sort field and direction (currently only supports timestamp sorting, unused for now)
            _query: Search query (not yet implemented)
        """

        # Step 1: Find conversation IDs with spans in the time range
        conversation_ids_results = Spans.run_table_query(
            params=snuba_params,
            query_string="has:gen_ai.conversation.id",
            selected_columns=[
                "gen_ai.conversation.id",
                "max(precise.finish_ts)",
            ],
            orderby=["-max(precise.finish_ts)"],
            offset=offset,
            limit=limit,
            referrer=Referrer.API_AI_CONVERSATIONS.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode="NORMAL",
        )

        logger.info(
            "[ai-conversations] Got Conversation IDs results",
            extra={"conversation_ids_results": conversation_ids_results},
        )

        conversation_ids: list[str] = [
            conv_id
            for row in conversation_ids_results.get("data", [])
            if (conv_id := row.get("gen_ai.conversation.id"))
        ]

        if not conversation_ids:
            return []

        # Step 2 & 3: Run aggregation and enrichment queries in parallel
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_aggregations = executor.submit(
                self._get_aggregations, snuba_params, conversation_ids
            )
            future_enrichment = executor.submit(
                self._get_enrichment_data, snuba_params, conversation_ids
            )

            results = future_aggregations.result()
            enrichment_data = future_enrichment.result()

        # Create a map of conversation data by ID
        conversations_map = {}
        for row in results.get("data", []):
            start_ts = row.get("min(precise.start_ts)", 0)
            finish_ts = row.get("max(precise.finish_ts)", 0)
            duration_ms = int((finish_ts - start_ts) * 1000) if finish_ts and start_ts else 0
            timestamp_ms = int(finish_ts * 1000) if finish_ts else 0

            conv_id = row.get("gen_ai.conversation.id", "")
            conversations_map[conv_id] = {
                "conversationId": conv_id,
                "flow": [],
                "duration": duration_ms,
                "errors": int(row.get("failure_count()") or 0),
                "llmCalls": int(row.get("count_if(gen_ai.operation.type,equals,ai_client)") or 0),
                "toolCalls": int(row.get("count_if(span.op,equals,gen_ai.execute_tool)") or 0),
                "totalTokens": int(row.get("sum(gen_ai.usage.total_tokens)") or 0),
                "totalCost": float(row.get("sum(gen_ai.usage.total_cost)") or 0),
                "timestamp": timestamp_ms,
                "traceCount": 0,  # Will be set in _apply_enrichment
                "traceIds": [],
            }

        logger.info(
            "[ai-conversations] Got conversations map",
            extra={"conversations_map": json.dumps(conversations_map)},
        )

        # Preserve the order from step 1
        conversations = [
            conversations_map[conv_id]
            for conv_id in conversation_ids
            if conv_id in conversations_map
        ]

        if conversations:
            self._apply_enrichment(conversations, enrichment_data)

        return conversations

    def _get_aggregations(self, snuba_params, conversation_ids: list[str]) -> dict[str, Any]:
        """
        Get aggregated metrics for conversations (query 2).
        """
        logger.info(
            "[ai-conversations] Getting complete aggregations for conversations",
            extra={"conversation_ids": conversation_ids},
        )
        results = Spans.run_table_query(
            params=snuba_params,
            query_string=f"gen_ai.conversation.id:[{','.join(conversation_ids)}]",
            selected_columns=[
                "gen_ai.conversation.id",
                "failure_count()",
                "count_if(gen_ai.operation.type,equals,ai_client)",
                "count_if(span.op,equals,gen_ai.execute_tool)",
                "sum(gen_ai.usage.total_tokens)",
                "sum(gen_ai.usage.total_cost)",
                "min(precise.start_ts)",
                "max(precise.finish_ts)",
            ],
            orderby=None,
            offset=0,
            limit=len(conversation_ids),
            referrer=Referrer.API_AI_CONVERSATIONS_COMPLETE.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode="HIGHEST_ACCURACY",
        )

        logger.info(
            "[ai-conversations] Got complete aggregations for conversations",
            extra={"results": json.dumps(results)},
        )
        return cast(dict[str, Any], results)

    def _get_enrichment_data(self, snuba_params, conversation_ids: list[str]) -> dict[str, Any]:
        """
        Get enrichment data (flows and trace IDs) for conversations (query 3).
        """
        logger.info(
            "[ai-conversations] Enriching conversations",
            extra={"conversation_ids": conversation_ids},
        )
        all_spans_results = Spans.run_table_query(
            params=snuba_params,
            query_string=f"gen_ai.conversation.id:[{','.join(conversation_ids)}]",
            selected_columns=[
                "gen_ai.conversation.id",
                "span.op",
                "gen_ai.agent.name",
                "trace",
                "precise.start_ts",
            ],
            orderby=["precise.start_ts"],
            offset=0,
            limit=10000,
            referrer=Referrer.API_AI_CONVERSATIONS_ENRICHMENT.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode="HIGHEST_ACCURACY",
        )
        logger.info(
            "[ai-conversations] Got all spans results",
            extra={"all_spans_results": json.dumps(all_spans_results)},
        )
        return cast(dict[str, Any], all_spans_results)

    def _apply_enrichment(self, conversations: list[dict], enrichment_data: dict) -> None:
        """
        Apply enrichment data (flows and trace IDs) to conversations.
        """
        flows_by_conversation = defaultdict(list)
        traces_by_conversation = defaultdict(set)
        logger.info(
            "[ai-conversations] Collecting traces and flows",
            extra={"enrichment_data": json.dumps(enrichment_data)},
        )
        for row in enrichment_data.get("data", []):
            conv_id = row.get("gen_ai.conversation.id", "")
            if not conv_id:
                continue

            # Collect trace IDs
            trace_id = row.get("trace", "")
            if trace_id:
                traces_by_conversation[conv_id].add(trace_id)

            # Collect agent flow (only from invoke_agent spans)
            if row.get("span.op") == "gen_ai.invoke_agent":
                agent_name = row.get("gen_ai.agent.name", "")
                if agent_name:
                    flows_by_conversation[conv_id].append(agent_name)

        for conversation in conversations:
            conv_id = conversation["conversationId"]
            traces = traces_by_conversation.get(conv_id, set())
            conversation["flow"] = flows_by_conversation.get(conv_id, [])
            conversation["traceIds"] = list(traces)
            conversation["traceCount"] = len(traces)

        logger.info(
            "[ai-conversations] Enriched conversations",
            extra={"conversations": json.dumps(conversations)},
        )
