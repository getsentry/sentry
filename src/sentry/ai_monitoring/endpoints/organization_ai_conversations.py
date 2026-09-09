import logging
import re
from collections.abc import Mapping, Sequence
from typing import TypedDict

import sentry_sdk
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.ai_monitoring.constants import AI_CONVERSATIONS_FIELDS
from sentry.ai_monitoring.conversation_titles import fetch_conversation_titles
from sentry.ai_monitoring.serializers import OrganizationAIConversationsSerializer
from sentry.ai_monitoring.utils import (
    get_aggregated_first_input,
    get_aggregated_last_output,
    timestamp_to_float,
)
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.ai_conversation_examples import AIConversationExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, OrganizationParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import EAPResponse, FieldsACL, SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.tracing import trace

logger = logging.getLogger("sentry.api.endpoints.organization_ai_conversations")


class UserResponse(TypedDict):
    id: str | None
    email: str | None
    username: str | None
    ip_address: str | None


class AIConversationResponse(TypedDict):
    conversationId: str
    title: str | None
    projectId: int | None
    flow: list[str]
    errors: int
    llmCalls: int
    toolCalls: int
    totalTokens: int
    inputTokens: int
    outputTokens: int
    totalCost: float
    generationDuration: float
    startTimestamp: int
    endTimestamp: int
    traceCount: int
    traceIds: list[str]
    firstInput: str | None
    lastOutput: str | None
    user: UserResponse | None
    toolNames: list[str]
    toolErrors: int


# Matches a query that is exactly a single gen_ai.conversation.id filter, e.g.
# `gen_ai.conversation.id:abc` or `gen_ai.conversation.id:"slack:1234"`.
_CONVERSATION_ID_LOOKUP_RE = re.compile(r'^gen_ai\.conversation\.id:(?:"[^"]+"|\S+)$')

AI_CONVERSATIONS_QUERY_PARAM = OpenApiParameter(
    name="query",
    location="query",
    required=False,
    type=str,
    description=(
        "Sentry search syntax matched against spans. A conversation is returned when any "
        "span in it matches. Summary fields include all spans in selected projects and time "
        "range, not only matching spans."
    ),
)

AI_CONVERSATIONS_PER_PAGE_PARAM = OpenApiParameter(
    name="per_page",
    location="query",
    required=False,
    type=int,
    description="Number of conversations to return per page. Defaults to 10; maximum is 100.",
)


def _is_conversation_id_lookup(user_query: str) -> bool:
    return bool(_CONVERSATION_ID_LOOKUP_RE.match(user_query.strip()))


def _build_conversation_query(base_query: str, user_query: str) -> str:
    if user_query and user_query.strip():
        return f"{base_query} {user_query.strip()}"
    return base_query


def _extract_conversation_ids(results: EAPResponse) -> list[str]:
    return [
        conv_id for row in results.get("data", []) if (conv_id := row.get("gen_ai.conversation.id"))
    ]


def _compute_timestamp_ms(finish_ts: float) -> int:
    return int(finish_ts * 1000) if finish_ts else 0


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
    input_tokens: int,
    output_tokens: int,
    total_cost: float,
    trace_ids: list[str],
    flow: list[str],
    first_input: str | None,
    last_output: str | None,
    user: UserResponse | None = None,
    tool_names: list[str] | None = None,
    tool_errors: int = 0,
    title: str | None = None,
    generation_duration: float = 0,
    project_id: int | None = None,
) -> AIConversationResponse:
    return {
        "conversationId": conv_id,
        "title": title,
        "projectId": project_id,
        "flow": flow,
        "errors": errors,
        "llmCalls": llm_calls,
        "toolCalls": tool_calls,
        "totalTokens": total_tokens,
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
        "totalCost": total_cost,
        "generationDuration": generation_duration,
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


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationAIConversationsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    @extend_schema(
        operation_id="listOrganizationAIConversations",
        summary="List an Organization's AI Conversations",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            AI_CONVERSATIONS_QUERY_PARAM,
            CursorQueryParam,
            AI_CONVERSATIONS_PER_PAGE_PARAM,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListOrganizationAIConversationsResponse", list[AIConversationResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=AIConversationExamples.LIST_AI_CONVERSATIONS,
    )
    def get(
        self, request: Request, organization: Organization
    ) -> (
        Response[list[AIConversationResponse]] | Response[ValidationErrorResponse] | Response[None]
    ):
        """Return AI conversations ordered by latest span time.

        **Experimental:** This API is under active development and may change.

        `query` uses Sentry search syntax against spans. A conversation matches when
        any span matches. Summary values then include all conversation spans inside
        selected project, environment, and time filters.
        """
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        sorting_enabled = features.has(
            "organizations:gen-ai-conversations-querying-enhancements", organization
        )
        serializer = OrganizationAIConversationsSerializer(
            data=request.GET, context={"sorting_enabled": sorting_enabled}
        )
        if not serializer.is_valid():
            return Response(as_validation_errors(serializer), status=400)

        validated_data = serializer.validated_data

        def data_fn(offset: int, limit: int) -> list[AIConversationResponse]:
            return self._get_conversations(
                snuba_params=snuba_params,
                offset=offset,
                limit=limit,
                user_query=validated_data.get("query", ""),
                sampling_mode=validated_data.get("samplingMode", "NORMAL"),
                sorts=validated_data["sort"] if sorting_enabled else None,
            )

        with handle_query_errors():
            response = self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=lambda results: results,
                default_per_page=10,
                max_per_page=100,
            )

        # A search for a single conversation ID that resolves to exactly one
        # conversation signals the client to redirect straight to the detail view.
        if (
            _is_conversation_id_lookup(validated_data.get("query") or "")
            and len(response.data) == 1
        ):
            response["X-Sentry-Direct-Hit"] = "1"

        return response

    @trace
    def _get_conversations(
        self,
        snuba_params: SnubaParams,
        offset: int,
        limit: int,
        user_query: str,
        sampling_mode: SAMPLING_MODES = "NORMAL",
        sorts: Sequence[str] | None = None,
    ) -> list[AIConversationResponse]:
        base_filter = "has:gen_ai.conversation.id has:gen_ai.operation.type"
        query_string = _build_conversation_query(base_filter, user_query)

        conversation_ids_results = self._fetch_conversation_ids(
            snuba_params, query_string, offset, limit, sampling_mode, sorts
        )
        conversation_ids = _extract_conversation_ids(conversation_ids_results)

        sentry_sdk.set_tag("ai_conversations.count", len(conversation_ids))
        sentry_sdk.set_attribute("ai_conversations.count", len(conversation_ids))

        if not conversation_ids:
            return []

        return self._get_conversations_data(snuba_params, conversation_ids)

    @trace
    def _fetch_conversation_ids(
        self,
        snuba_params: SnubaParams,
        query_string: str,
        offset: int,
        limit: int,
        sampling_mode: SAMPLING_MODES,
        sorts: Sequence[str] | None = None,
    ) -> EAPResponse:
        selected_columns = ["gen_ai.conversation.id", "max(precise.finish_ts)"]
        orderby = ["-max(precise.finish_ts)"]
        if sorts is not None:
            # Keep groups with missing sort attributes: EAP filters for the presence
            # of at least one selected aggregate attribute. Timestamp is always present.
            selected_columns = ["gen_ai.conversation.id", "max(timestamp)"]
            selected_aliases = set(selected_columns)
            orderby = []
            for sort in sorts:
                expression, alias = AI_CONVERSATIONS_FIELDS[sort.removeprefix("-")]
                orderby.append(("-" if sort.startswith("-") else "") + alias)
                if alias not in selected_aliases:
                    selected_columns.append(
                        expression if expression == alias else f"{expression} as {alias}"
                    )
                    selected_aliases.add(alias)
            if not any(column.removeprefix("-") == "gen_ai.conversation.id" for column in orderby):
                orderby.append("gen_ai.conversation.id")

        # TODO (vgrozdanic): Sort on whole conversations instead of only matching spans.
        return Spans.run_table_query(
            params=snuba_params,
            query_string=query_string,
            selected_columns=selected_columns,
            orderby=orderby,
            offset=offset,
            limit=limit,
            referrer=Referrer.API_AI_CONVERSATIONS.value,
            config=SearchResolverConfig(auto_fields=True, disable_aggregate_extrapolation=True),
            sampling_mode=sampling_mode,
        )

    @trace
    def _get_conversations_data(
        self, snuba_params: SnubaParams, conversation_ids: list[str]
    ) -> list[AIConversationResponse]:
        operation_filter = "has:gen_ai.operation.type"
        ai_client_filter = "gen_ai.operation.type:ai_client"
        results = Spans.run_table_query(
            params=snuba_params,
            query_string=build_escaped_term_filter("gen_ai.conversation.id", conversation_ids),
            selected_columns=[
                "gen_ai.conversation.id",
                "failure_count() as errors",
                "count_if(gen_ai.operation.type,equals,ai_client) as llm_calls",
                "count_if(gen_ai.operation.type,equals,tool) as tool_calls",
                "sum_if(gen_ai.usage.total_tokens,gen_ai.operation.type,equals,ai_client) as total_tokens",
                "sum_if(gen_ai.usage.input_tokens,gen_ai.operation.type,equals,ai_client) as input_tokens",
                "sum_if(gen_ai.usage.output_tokens,gen_ai.operation.type,equals,ai_client) as output_tokens",
                "sum_if(gen_ai.cost.total_tokens,gen_ai.operation.type,equals,ai_client) as total_cost",
                "sum_if(span.duration,gen_ai.operation.type,equals,ai_client) as generation_duration",
                "min(timestamp) as start_timestamp",
                "max(timestamp) as end_timestamp",
                f"collect_unique_if(`{operation_filter}`, trace) as trace_ids",
                f"collect_unique_if(`{operation_filter}`, project.id) as project_ids",
                "collect_unique_if(`gen_ai.operation.type:agent`, gen_ai.agent.name) as flow",
                "collect_unique_if(`gen_ai.operation.type:tool`, gen_ai.tool.name) as tool_names",
                "failure_count_if(gen_ai.operation.type,equals,tool) as tool_errors",
                f"first_if(`{operation_filter}`, user.id, timestamp) as user_id",
                f"first_if(`{operation_filter}`, user.email, timestamp) as user_email",
                f"first_if(`{operation_filter}`, user.username, timestamp) as user_username",
                f"first_if(`{operation_filter}`, user.ip, timestamp) as user_ip",
                f"first_if(`{ai_client_filter}`, gen_ai.input.messages, timestamp) as input_messages",
                f"min_if(`{ai_client_filter} has:gen_ai.input.messages`, timestamp) as input_messages_timestamp",
                f"first_if(`{ai_client_filter}`, gen_ai.request.messages, timestamp) as request_messages",
                f"min_if(`{ai_client_filter} has:gen_ai.request.messages`, timestamp) as request_messages_timestamp",
                f"last_if(`{ai_client_filter}`, gen_ai.output.messages, timestamp) as output_messages",
                f"max_if(`{ai_client_filter} has:gen_ai.output.messages`, timestamp) as output_messages_timestamp",
                f"last_if(`{ai_client_filter}`, gen_ai.response.text, timestamp) as response_text",
                f"max_if(`{ai_client_filter} has:gen_ai.response.text`, timestamp) as response_text_timestamp",
            ],
            orderby=None,
            offset=0,
            limit=len(conversation_ids),
            referrer=Referrer.API_AI_CONVERSATIONS_COMPLETE.value,
            config=SearchResolverConfig(
                auto_fields=True,
                disable_aggregate_extrapolation=True,
                fields_acl=FieldsACL(functions={"collect_unique_if", "first_if", "last_if"}),
            ),
            sampling_mode="HIGHEST_ACCURACY",
        )

        conversations_map: dict[str, AIConversationResponse] = {}
        project_ids_by_conversation: dict[str, set[int]] = {}
        for row in results.get("data", []):
            conversation_id = str(row.get("gen_ai.conversation.id") or "")
            project_ids = {
                project_id
                for project_id in row.get("project_ids", [])
                if isinstance(project_id, int)
            }
            trace_ids = sorted(row.get("trace_ids") or [])
            conversations_map[conversation_id] = _build_conversation_response(
                conv_id=conversation_id,
                start_timestamp=_compute_timestamp_ms(
                    timestamp_to_float(row.get("start_timestamp"))
                ),
                end_timestamp=_compute_timestamp_ms(timestamp_to_float(row.get("end_timestamp"))),
                errors=int(row.get("errors") or 0),
                llm_calls=int(row.get("llm_calls") or 0),
                tool_calls=int(row.get("tool_calls") or 0),
                total_tokens=int(row.get("total_tokens") or 0),
                input_tokens=int(row.get("input_tokens") or 0),
                output_tokens=int(row.get("output_tokens") or 0),
                total_cost=float(row.get("total_cost") or 0),
                generation_duration=float(row.get("generation_duration") or 0),
                trace_ids=trace_ids,
                flow=row.get("flow") or [],
                first_input=get_aggregated_first_input(row),
                last_output=get_aggregated_last_output(row),
                user=_build_user_response(
                    user_id=row.get("user_id"),
                    user_email=row.get("user_email"),
                    user_username=row.get("user_username"),
                    user_ip=row.get("user_ip"),
                ),
                tool_names=sorted(row.get("tool_names") or []),
                tool_errors=int(row.get("tool_errors") or 0),
                project_id=min(project_ids, default=None),
            )
            project_ids_by_conversation[conversation_id] = project_ids

        self._apply_titles(conversations_map, project_ids_by_conversation)
        return [
            conversations_map[conversation_id]
            for conversation_id in conversation_ids
            if conversation_id in conversations_map
        ]

    @trace
    def _apply_titles(
        self,
        conversations_map: dict[str, AIConversationResponse],
        project_ids_by_conversation: Mapping[str, set[int]],
    ) -> None:
        """Set each conversation's `title` from storage when present.

        On lookup failure, log and leave titles unset so the list response still succeeds.
        """
        pairs = [
            (conv_id, project_id)
            for conv_id in conversations_map
            for project_id in project_ids_by_conversation.get(conv_id, ())
        ]
        try:
            titles = fetch_conversation_titles(pairs)
        except Exception:
            logger.exception(
                "Failed to resolve titles for AI conversations",
                extra={"project_ids": sorted({project_id for _, project_id in pairs})},
            )
            return

        for conv_id, title in titles.items():
            conversations_map[conv_id]["title"] = title
