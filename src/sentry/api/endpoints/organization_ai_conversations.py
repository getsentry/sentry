import json  # noqa: S003
import logging
from collections import defaultdict
from datetime import datetime
from typing import Any, TypedDict

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers.rest_framework import OrganizationAIConversationsSerializer
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import EAPResponse, SearchResolverConfig
from sentry.search.events.constants import NON_FAILURE_STATUS
from sentry.search.events.types import SAMPLING_MODES
from sentry.snuba.referrer import Referrer
from sentry.snuba.rpc_dataset_common import TableQuery
from sentry.snuba.spans_rpc import Spans

logger = logging.getLogger("sentry.api.endpoints.organization_ai_conversations")


def _build_conversation_query(base_query: str, user_query: str) -> str:
    if user_query and user_query.strip():
        return f"{base_query} {user_query.strip()}"
    return base_query


def _extract_conversation_ids(results: EAPResponse) -> list[str]:
    return [
        conv_id for row in results.get("data", []) if (conv_id := row.get("gen_ai.conversation.id"))
    ]


def _to_timestamp_float(ts: Any) -> float:
    """Convert timestamp to float (seconds since epoch)."""
    if ts is None:
        return 0.0
    if isinstance(ts, (int, float)):
        return float(ts)
    if hasattr(ts, "timestamp"):
        return ts.timestamp()
    if isinstance(ts, str):
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return dt.timestamp()
        except (ValueError, TypeError):
            return 0.0
    return 0.0


def _compute_timestamp_ms(finish_ts: float) -> int:
    return int(finish_ts * 1000) if finish_ts else 0


def _parse_messages(messages: str | list | None) -> list | None:
    if not messages:
        return None
    if isinstance(messages, str):
        try:
            messages = json.loads(messages)
        except (json.JSONDecodeError, TypeError):
            return None
    if not isinstance(messages, list):
        return None
    return messages


def _extract_content_from_parts(msg: dict) -> str | None:
    """Extract text content from a message with parts format, concatenating multiple text parts."""
    parts = msg.get("parts", [])
    if not isinstance(parts, list):
        return None

    text_contents = []
    for part in parts:
        if isinstance(part, dict) and part.get("type") == "text":
            content = part.get("content")
            if content:
                text_contents.append(content)

    return "\n".join(text_contents) if text_contents else None


def _extract_first_user_message(messages: str | list | None) -> str | None:
    """Extract first user message, handling both old (content) and new (parts) formats."""
    parsed = _parse_messages(messages)
    if not parsed:
        return None
    for msg in parsed:
        if isinstance(msg, dict) and msg.get("role") == "user":
            # Try old format first (content field)
            content = msg.get("content")
            if content:
                return content
            # Try new parts format
            return _extract_content_from_parts(msg)
    return None


def _get_first_input_message(row: dict) -> str | None:
    """
    Gets first user message from input attributes, checking in priority order.
    Priority: gen_ai.input.messages > gen_ai.request.messages
    """
    # 1. Check new format first (gen_ai.input.messages)
    input_messages = row.get("gen_ai.input.messages")
    if input_messages:
        first_user = _extract_first_user_message(input_messages)
        if first_user:
            return first_user

    # 2. Check current format (gen_ai.request.messages)
    request_messages = row.get("gen_ai.request.messages")
    if request_messages:
        return _extract_first_user_message(request_messages)

    return None


def _get_last_output(row: dict) -> str | None:
    """
    Gets output text from output attributes, checking in priority order.
    Priority: gen_ai.output.messages > gen_ai.response.text
    """
    # 1. Check new format first (gen_ai.output.messages)
    output_messages = row.get("gen_ai.output.messages")
    if output_messages:
        # Extract text from the last assistant message
        parsed = _parse_messages(output_messages)
        if parsed:
            for msg in reversed(parsed):
                if isinstance(msg, dict) and msg.get("role") == "assistant":
                    # Try old format first (content field)
                    content = msg.get("content")
                    if content:
                        return content
                    # Try new parts format
                    parts_content = _extract_content_from_parts(msg)
                    if parts_content:
                        return parts_content

    # 2. Check current format (gen_ai.response.text)
    response_text = row.get("gen_ai.response.text")
    if response_text:
        return response_text

    return None


class UserResponse(TypedDict):
    id: str | None
    email: str | None
    username: str | None
    ip_address: str | None


def _build_user_response(
    user_id: str | None,
    user_email: str | None,
    user_username: str | None,
    user_ip: str | None,
) -> UserResponse | None:
    """Build user response object, returning None if no user data is available."""
    if not any([user_id, user_email, user_username, user_ip]):
        return None
    return {
        "id": user_id,
        "email": user_email,
        "username": user_username,
        "ip_address": user_ip,
    }


def _build_conversation_response(
    conv_id: str,
    start_timestamp: int,
    end_timestamp: int,
    errors: int,
    llm_calls: int,
    tool_calls: int,
    total_tokens: int,
    total_cost: float,
    trace_ids: list[str],
    flow: list[str],
    first_input: str | None,
    last_output: str | None,
    user: dict[str, str | None] | None = None,
    tool_names: list[str] | None = None,
    tool_errors: int = 0,
) -> dict[str, Any]:
    return {
        "conversationId": conv_id,
        "flow": flow,
        "errors": errors,
        "llmCalls": llm_calls,
        "toolCalls": tool_calls,
        "totalTokens": total_tokens,
        "totalCost": total_cost,
        "startTimestamp": start_timestamp,
        "endTimestamp": end_timestamp,
        "traceCount": len(trace_ids),
        "traceIds": trace_ids,
        "firstInput": first_input,
        "lastOutput": last_output,
        "user": user,
        "toolNames": tool_names or [],
        "toolErrors": tool_errors,
    }


@region_silo_endpoint
class OrganizationAIConversationsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING

    def get(self, request: Request, organization: Organization) -> Response:
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

        def data_fn(offset: int, limit: int):
            return self._get_conversations(
                snuba_params=snuba_params,
                offset=offset,
                limit=limit,
                user_query=validated_data.get("query", ""),
                sampling_mode=validated_data.get("samplingMode", "NORMAL"),
            )

        with handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=lambda results: results,
                default_per_page=10,
                max_per_page=100,
            )

    @sentry_sdk.trace
    def _get_conversations(
        self,
        snuba_params,
        offset: int,
        limit: int,
        user_query: str,
        sampling_mode: SAMPLING_MODES = "NORMAL",
    ) -> list[dict]:
        query_string = _build_conversation_query("has:gen_ai.conversation.id", user_query)

        conversation_ids_results = self._fetch_conversation_ids(
            snuba_params, query_string, offset, limit, sampling_mode
        )
        conversation_ids = _extract_conversation_ids(conversation_ids_results)

        sentry_sdk.set_tag("ai_conversations.count", len(conversation_ids))

        if not conversation_ids:
            return []

        return self._get_conversations_data(snuba_params, conversation_ids)

    @sentry_sdk.trace
    def _fetch_conversation_ids(
        self,
        snuba_params,
        query_string: str,
        offset: int,
        limit: int,
        sampling_mode: SAMPLING_MODES,
    ) -> EAPResponse:
        return Spans.run_table_query(
            params=snuba_params,
            query_string=query_string,
            selected_columns=["gen_ai.conversation.id", "max(precise.finish_ts)"],
            orderby=["-max(precise.finish_ts)"],
            offset=offset,
            limit=limit,
            referrer=Referrer.API_AI_CONVERSATIONS.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode=sampling_mode,
        )

    @sentry_sdk.trace
    def _get_conversations_data(self, snuba_params, conversation_ids: list[str]) -> list[dict]:
        config = SearchResolverConfig(auto_fields=True)
        resolver = Spans.get_resolver(snuba_params, config)

        # Build queries
        queries = [
            self._build_aggregations_query(resolver, conversation_ids),
            self._build_enrichment_query(resolver, conversation_ids),
            self._build_first_last_io_query(resolver, conversation_ids),
        ]

        # Execute all queries in a single bulk RPC call
        with sentry_sdk.start_span(
            op="ai_conversations.bulk_rpc", name="Execute bulk table queries"
        ):
            results = Spans.run_bulk_table_queries(queries)

        # Process results
        with sentry_sdk.start_span(op="ai_conversations.process", name="Process query results"):
            conversations_map = self._build_conversations_from_aggregations(results["aggregations"])
            self._apply_enrichment(conversations_map, results["enrichment"])
            self._apply_first_last_io(conversations_map, results["first_last_io"])

        return [
            conversations_map[conv_id]
            for conv_id in conversation_ids
            if conv_id in conversations_map
        ]

    def _build_aggregations_query(
        self, resolver: SearchResolver, conversation_ids: list[str]
    ) -> TableQuery:
        return TableQuery(
            name="aggregations",
            query_string=f"gen_ai.conversation.id:[{','.join(conversation_ids)}]",
            selected_columns=[
                "gen_ai.conversation.id",
                "failure_count()",
                "count_if(gen_ai.operation.type,equals,ai_client)",
                "count_if(gen_ai.operation.type,equals,tool)",
                "sum_if(gen_ai.usage.total_tokens,gen_ai.operation.type,equals,ai_client)",
                "sum_if(gen_ai.cost.total_tokens,gen_ai.operation.type,equals,ai_client)",
                "min(precise.start_ts)",
                "max(precise.finish_ts)",
            ],
            orderby=None,
            offset=0,
            limit=len(conversation_ids),
            referrer=Referrer.API_AI_CONVERSATIONS_COMPLETE.value,
            sampling_mode="HIGHEST_ACCURACY",
            resolver=resolver,
        )

    def _build_enrichment_query(
        self, resolver: SearchResolver, conversation_ids: list[str]
    ) -> TableQuery:
        return TableQuery(
            name="enrichment",
            query_string=f"gen_ai.conversation.id:[{','.join(conversation_ids)}]",
            selected_columns=[
                "gen_ai.conversation.id",
                "gen_ai.operation.type",
                "gen_ai.agent.name",
                "gen_ai.tool.name",
                "span.status",
                "trace",
                "timestamp",
                "user.id",
                "user.email",
                "user.username",
                "user.ip",
            ],
            orderby=["timestamp"],
            offset=0,
            limit=10000,
            referrer=Referrer.API_AI_CONVERSATIONS_ENRICHMENT.value,
            sampling_mode="HIGHEST_ACCURACY",
            resolver=resolver,
        )

    def _build_first_last_io_query(
        self, resolver: SearchResolver, conversation_ids: list[str]
    ) -> TableQuery:
        return TableQuery(
            name="first_last_io",
            query_string=f"gen_ai.conversation.id:[{','.join(conversation_ids)}] gen_ai.operation.type:ai_client",
            selected_columns=[
                "gen_ai.conversation.id",
                "gen_ai.input.messages",
                "gen_ai.output.messages",
                "gen_ai.request.messages",
                "gen_ai.response.text",
                "timestamp",
            ],
            orderby=["timestamp"],
            offset=0,
            limit=10000,
            referrer=Referrer.API_AI_CONVERSATIONS_FIRST_LAST_IO.value,
            sampling_mode="HIGHEST_ACCURACY",
            resolver=resolver,
        )

    def _build_conversations_from_aggregations(
        self, aggregations: EAPResponse
    ) -> dict[str, dict[str, Any]]:
        with sentry_sdk.start_span(
            op="ai_conversations.build_from_aggregations",
            name="Build conversations from aggregations",
        ):
            conversations_map: dict[str, dict[str, Any]] = {}

            for row in aggregations.get("data", []):
                conv_id = row.get("gen_ai.conversation.id", "")
                start_ts = row.get("min(precise.start_ts)", 0)
                finish_ts = row.get("max(precise.finish_ts)", 0)

                conversations_map[conv_id] = _build_conversation_response(
                    conv_id=conv_id,
                    start_timestamp=_compute_timestamp_ms(start_ts),
                    end_timestamp=_compute_timestamp_ms(finish_ts),
                    errors=int(row.get("failure_count()") or 0),
                    llm_calls=int(row.get("count_if(gen_ai.operation.type,equals,ai_client)") or 0),
                    tool_calls=int(row.get("count_if(gen_ai.operation.type,equals,tool)") or 0),
                    total_tokens=int(
                        row.get(
                            "sum_if(gen_ai.usage.total_tokens,gen_ai.operation.type,equals,ai_client)"
                        )
                        or 0
                    ),
                    total_cost=float(
                        row.get(
                            "sum_if(gen_ai.cost.total_tokens,gen_ai.operation.type,equals,ai_client)"
                        )
                        or 0
                    ),
                    trace_ids=[],
                    flow=[],
                    first_input=None,
                    last_output=None,
                )

            return conversations_map

    def _apply_enrichment(
        self, conversations_map: dict[str, dict[str, Any]], enrichment_data: EAPResponse
    ) -> None:
        with sentry_sdk.start_span(
            op="ai_conversations.apply_enrichment",
            name="Apply enrichment data",
        ) as span:
            enrichment_rows = enrichment_data.get("data", [])
            span.set_data("rows_count", len(enrichment_rows))

            flows_by_conversation: dict[str, list[str]] = defaultdict(list)
            traces_by_conversation: dict[str, set[str]] = defaultdict(set)
            tool_names_by_conversation: dict[str, set[str]] = defaultdict(set)
            tool_errors_by_conversation: dict[str, int] = defaultdict(int)
            # Track first user data per conversation (data is sorted by timestamp, so first occurrence wins)
            user_by_conversation: dict[str, UserResponse] = {}

            for row in enrichment_rows:
                conv_id = row.get("gen_ai.conversation.id", "")
                if not conv_id:
                    continue

                trace_id = row.get("trace", "")
                if trace_id:
                    traces_by_conversation[conv_id].add(trace_id)

                if row.get("gen_ai.operation.type") == "invoke_agent":
                    agent_name = row.get("gen_ai.agent.name", "")
                    if agent_name:
                        flows_by_conversation[conv_id].append(agent_name)

                if row.get("gen_ai.operation.type") == "tool":
                    tool_name = row.get("gen_ai.tool.name")
                    if tool_name:
                        tool_names_by_conversation[conv_id].add(tool_name)
                    status = row.get("span.status", "ok")
                    if status and status not in NON_FAILURE_STATUS:
                        tool_errors_by_conversation[conv_id] += 1

                # Capture user from the first span (earliest timestamp) for each conversation
                if conv_id not in user_by_conversation:
                    user_data = _build_user_response(
                        user_id=row.get("user.id"),
                        user_email=row.get("user.email"),
                        user_username=row.get("user.username"),
                        user_ip=row.get("user.ip"),
                    )
                    if user_data:
                        user_by_conversation[conv_id] = user_data

            for conv_id, conversation in conversations_map.items():
                traces = traces_by_conversation.get(conv_id, set())
                conversation["flow"] = flows_by_conversation.get(conv_id, [])
                conversation["traceIds"] = list(traces)
                conversation["traceCount"] = len(traces)
                conversation["user"] = user_by_conversation.get(conv_id)
                conversation["toolNames"] = sorted(tool_names_by_conversation.get(conv_id, set()))
                conversation["toolErrors"] = tool_errors_by_conversation.get(conv_id, 0)

    def _apply_first_last_io(
        self, conversations_map: dict[str, dict[str, Any]], first_last_io_data: EAPResponse
    ) -> None:
        with sentry_sdk.start_span(
            op="ai_conversations.apply_first_last_io",
            name="Apply first/last IO data",
        ) as span:
            io_rows = first_last_io_data.get("data", [])
            span.set_data("rows_count", len(io_rows))

            first_input_by_conv: dict[str, str] = {}
            last_output_by_conv: dict[str, tuple[float, str]] = {}

            for row in io_rows:
                conv_id = row.get("gen_ai.conversation.id", "")
                if not conv_id:
                    continue

                ts = _to_timestamp_float(row.get("timestamp"))

                # Use the new helper functions for priority-based extraction
                if conv_id not in first_input_by_conv:
                    first_user_content = _get_first_input_message(row)
                    if first_user_content:
                        first_input_by_conv[conv_id] = first_user_content

                output_content = _get_last_output(row)
                if output_content:
                    current = last_output_by_conv.get(conv_id)
                    if current is None or ts > current[0]:
                        last_output_by_conv[conv_id] = (ts, output_content)

            for conv_id, conversation in conversations_map.items():
                conversation["firstInput"] = first_input_by_conv.get(conv_id)
                last_tuple = last_output_by_conv.get(conv_id)
                conversation["lastOutput"] = last_tuple[1] if last_tuple else None
