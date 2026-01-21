import json  # noqa: S003
import logging
from collections import defaultdict
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


def _compute_duration_ms(start_ts: float, finish_ts: float) -> int:
    if finish_ts and start_ts:
        return int((finish_ts - start_ts) * 1000)
    return 0


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
    duration: int,
    timestamp: int,
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
) -> dict[str, Any]:
    return {
        "conversationId": conv_id,
        "flow": flow,
        "duration": duration,
        "errors": errors,
        "llmCalls": llm_calls,
        "toolCalls": tool_calls,
        "totalTokens": total_tokens,
        "totalCost": total_cost,
        "timestamp": timestamp,
        "traceCount": len(trace_ids),
        "traceIds": trace_ids,
        "firstInput": first_input,
        "lastOutput": last_output,
        "user": user,
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
                use_optimized=validated_data.get("useOptimizedQuery", False),
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
        use_optimized: bool = False,
        sampling_mode: SAMPLING_MODES = "NORMAL",
    ) -> list[dict]:
        query_string = _build_conversation_query("has:gen_ai.conversation.id", user_query)

        conversation_ids_results = self._fetch_conversation_ids(
            snuba_params, query_string, offset, limit, sampling_mode
        )
        conversation_ids = _extract_conversation_ids(conversation_ids_results)

        sentry_sdk.set_tag("ai_conversations.count", len(conversation_ids))
        sentry_sdk.set_tag("ai_conversations.use_optimized", use_optimized)

        if not conversation_ids:
            return []

        if use_optimized:
            return self._get_conversations_optimized(snuba_params, conversation_ids)

        return self._get_conversations_default(snuba_params, conversation_ids)

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
    def _get_conversations_default(self, snuba_params, conversation_ids: list[str]) -> list[dict]:
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
                "sum(gen_ai.usage.total_tokens)",
                "sum(gen_ai.cost.total_tokens)",
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
                "trace",
                "precise.start_ts",
                "user.id",
                "user.email",
                "user.username",
                "user.ip",
            ],
            orderby=["precise.start_ts"],
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
                "precise.start_ts",
                "precise.finish_ts",
            ],
            orderby=["precise.start_ts"],
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
                    duration=_compute_duration_ms(start_ts, finish_ts),
                    timestamp=_compute_timestamp_ms(finish_ts),
                    errors=int(row.get("failure_count()") or 0),
                    llm_calls=int(row.get("count_if(gen_ai.operation.type,equals,ai_client)") or 0),
                    tool_calls=int(row.get("count_if(gen_ai.operation.type,equals,tool)") or 0),
                    total_tokens=int(row.get("sum(gen_ai.usage.total_tokens)") or 0),
                    total_cost=float(row.get("sum(gen_ai.cost.total_tokens)") or 0),
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
            # Track first user data per conversation (data is sorted by start_ts, so first occurrence wins)
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

                finish_ts = row.get("precise.finish_ts", 0)

                # Use the new helper functions for priority-based extraction
                if conv_id not in first_input_by_conv:
                    first_user_content = _get_first_input_message(row)
                    if first_user_content:
                        first_input_by_conv[conv_id] = first_user_content

                output_content = _get_last_output(row)
                if output_content:
                    current = last_output_by_conv.get(conv_id)
                    if current is None or finish_ts > current[0]:
                        last_output_by_conv[conv_id] = (finish_ts, output_content)

            for conv_id, conversation in conversations_map.items():
                conversation["firstInput"] = first_input_by_conv.get(conv_id)
                last_tuple = last_output_by_conv.get(conv_id)
                conversation["lastOutput"] = last_tuple[1] if last_tuple else None

    @sentry_sdk.trace
    def _get_conversations_optimized(self, snuba_params, conversation_ids: list[str]) -> list[dict]:
        all_spans = self._fetch_all_spans(snuba_params, conversation_ids)
        sentry_sdk.set_tag("ai_conversations.spans_fetched", len(all_spans.get("data", [])))
        return self._aggregate_spans(conversation_ids, all_spans)

    @sentry_sdk.trace
    def _fetch_all_spans(self, snuba_params, conversation_ids: list[str]) -> EAPResponse:
        return Spans.run_table_query(
            params=snuba_params,
            query_string=f"gen_ai.conversation.id:[{','.join(conversation_ids)}]",
            selected_columns=[
                "gen_ai.conversation.id",
                "precise.start_ts",
                "precise.finish_ts",
                "span.status",
                "gen_ai.operation.type",
                "gen_ai.usage.total_tokens",
                "gen_ai.cost.total_tokens",
                "trace",
                "gen_ai.agent.name",
                "gen_ai.input.messages",
                "gen_ai.output.messages",
                "gen_ai.request.messages",
                "gen_ai.response.text",
                "user.id",
                "user.email",
                "user.username",
                "user.ip",
            ],
            orderby=["precise.start_ts"],
            offset=0,
            limit=10000,
            referrer=Referrer.API_AI_CONVERSATIONS_COMPLETE.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode="HIGHEST_ACCURACY",
        )

    @sentry_sdk.trace
    def _aggregate_spans(self, conversation_ids: list[str], all_spans: EAPResponse) -> list[dict]:
        accumulators = self._init_accumulators(conversation_ids)
        with sentry_sdk.start_span(op="ai_conversations.process_spans", name="Process spans"):
            self._process_spans(accumulators, all_spans)
        return self._build_results_from_accumulators(conversation_ids, accumulators)

    def _init_accumulators(self, conversation_ids: list[str]) -> dict[str, dict[str, Any]]:
        return {
            conv_id: {
                "min_start_ts": float("inf"),
                "max_finish_ts": 0.0,
                "failure_count": 0,
                "ai_client_count": 0,
                "tool_count": 0,
                "total_tokens": 0,
                "total_cost": 0.0,
                "traces": set(),
                "flow": [],
                "first_input": None,
                "first_input_ts": float("inf"),
                "last_output": None,
                "last_output_ts": 0.0,
                "user": None,
            }
            for conv_id in conversation_ids
        }

    def _process_spans(
        self, accumulators: dict[str, dict[str, Any]], all_spans: EAPResponse
    ) -> None:
        for row in all_spans.get("data", []):
            conv_id = row.get("gen_ai.conversation.id", "")
            if conv_id not in accumulators:
                continue

            acc = accumulators[conv_id]
            self._update_timestamps(acc, row)
            self._update_counts(acc, row)
            self._update_tokens_and_cost(acc, row)
            self._update_traces(acc, row)
            self._update_first_last_io(acc, row)
            self._update_user(acc, row)

    def _update_timestamps(self, acc: dict[str, Any], row: dict[str, Any]) -> None:
        start_ts = row.get("precise.start_ts") or 0
        finish_ts = row.get("precise.finish_ts") or 0

        if start_ts and start_ts < acc["min_start_ts"]:
            acc["min_start_ts"] = start_ts
        if finish_ts and finish_ts > acc["max_finish_ts"]:
            acc["max_finish_ts"] = finish_ts

    def _update_counts(self, acc: dict[str, Any], row: dict[str, Any]) -> None:
        status = row.get("span.status", "")
        op_type = row.get("gen_ai.operation.type", "")

        if status and status != "ok":
            acc["failure_count"] += 1

        if op_type == "ai_client":
            acc["ai_client_count"] += 1
        elif op_type == "tool":
            acc["tool_count"] += 1
        elif op_type == "invoke_agent":
            agent_name = row.get("gen_ai.agent.name", "")
            if agent_name:
                acc["flow"].append(agent_name)

    def _update_tokens_and_cost(self, acc: dict[str, Any], row: dict[str, Any]) -> None:
        tokens = row.get("gen_ai.usage.total_tokens")
        if tokens:
            acc["total_tokens"] += int(tokens)

        cost = row.get("gen_ai.cost.total_tokens")
        if cost:
            acc["total_cost"] += float(cost)

    def _update_traces(self, acc: dict[str, Any], row: dict[str, Any]) -> None:
        trace_id = row.get("trace", "")
        if trace_id:
            acc["traces"].add(trace_id)

    def _update_first_last_io(self, acc: dict[str, Any], row: dict[str, Any]) -> None:
        op_type = row.get("gen_ai.operation.type", "")
        if op_type != "ai_client":
            return

        start_ts = row.get("precise.start_ts") or 0
        finish_ts = row.get("precise.finish_ts") or 0

        # Use the new helper functions for priority-based extraction
        if start_ts and start_ts < acc["first_input_ts"]:
            first_user = _get_first_input_message(row)
            if first_user:
                acc["first_input"] = first_user
                acc["first_input_ts"] = start_ts

        output_content = _get_last_output(row)
        if finish_ts and finish_ts > acc["last_output_ts"] and output_content:
            acc["last_output"] = output_content
            acc["last_output_ts"] = finish_ts

    def _update_user(self, acc: dict[str, Any], row: dict[str, Any]) -> None:
        # Capture user from the first span (data is sorted by start_ts)
        if acc["user"] is not None:
            return

        user_data = _build_user_response(
            user_id=row.get("user.id"),
            user_email=row.get("user.email"),
            user_username=row.get("user.username"),
            user_ip=row.get("user.ip"),
        )
        if user_data:
            acc["user"] = user_data

    def _build_results_from_accumulators(
        self, conversation_ids: list[str], accumulators: dict[str, dict[str, Any]]
    ) -> list[dict]:
        result = []

        for conv_id in conversation_ids:
            if conv_id not in accumulators:
                continue

            acc = accumulators[conv_id]
            min_ts = acc["min_start_ts"] if acc["min_start_ts"] != float("inf") else 0
            max_ts = acc["max_finish_ts"]

            result.append(
                _build_conversation_response(
                    conv_id=conv_id,
                    duration=_compute_duration_ms(min_ts, max_ts),
                    timestamp=_compute_timestamp_ms(max_ts),
                    errors=acc["failure_count"],
                    llm_calls=acc["ai_client_count"],
                    tool_calls=acc["tool_count"],
                    total_tokens=acc["total_tokens"],
                    total_cost=acc["total_cost"],
                    trace_ids=list(acc["traces"]),
                    flow=acc["flow"],
                    first_input=acc["first_input"],
                    last_output=acc["last_output"],
                    user=acc["user"],
                )
            )

        return result
