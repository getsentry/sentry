import logging
from collections.abc import Collection, Mapping, Sequence
from dataclasses import replace
from datetime import datetime, timedelta
from typing import Any, TypedDict

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.ai_monitoring.conversation_titles import fetch_conversation_title
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
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace import SpanIssueMeta, get_issues_by_span_for_traces
from sentry.utils import metrics
from sentry.utils.dates import parse_stats_period
from sentry.utils.tracing import trace

logger = logging.getLogger(__name__)

type SpanRow = dict[str, Any]
type SpanKey = tuple[str, str]

MAX_RETENTION_DAYS = 30
MAX_PARENT_REPAIR_DEPTH = 5

_WIDENING_STEPS = [timedelta(days=7), timedelta(days=14), timedelta(days=MAX_RETENTION_DAYS)]

AI_CONVERSATION_ID_PARAM = OpenApiParameter(
    name="conversation_id",
    location="path",
    required=True,
    type=str,
    description="Conversation ID recorded in `gen_ai.conversation.id`.",
)

AI_CONVERSATION_DETAILS_PER_PAGE_PARAM = OpenApiParameter(
    name="per_page",
    location="query",
    required=False,
    type=int,
    description="Number of spans to return per page. Defaults to 100; maximum is 1,000.",
)

PARENT_SPAN_ATTRIBUTES = [
    "span_id",
    "trace",
    "parent_span",
    "span.op",
    "span.name",
    "gen_ai.operation.type",
    "gen_ai.conversation.id",
]

AI_CONVERSATION_ATTRIBUTES = [
    "span_id",
    "trace",
    "parent_span",
    "precise.start_ts",
    "precise.finish_ts",
    "project",
    "project.id",
    "span.op",
    "span.status",
    "span.description",
    "span.name",
    "span.duration",
    "transaction",
    "is_transaction",
    "gen_ai.conversation.id",
    "gen_ai.cost.total_tokens",
    "gen_ai.operation.type",
    "gen_ai.input.messages",
    "gen_ai.output.messages",
    "gen_ai.system_instructions",
    "gen_ai.tool.definitions",
    "gen_ai.request.messages",
    "gen_ai.response.object",
    "gen_ai.response.text",
    "gen_ai.tool.name",
    "gen_ai.tool.call.arguments",
    "gen_ai.tool.input",
    "gen_ai.tool.call.result",
    "gen_ai.tool.output",
    "gen_ai.embeddings.input",
    "gen_ai.usage.total_tokens",
    "gen_ai.request.model",
    "gen_ai.response.model",
    "gen_ai.agent.name",
    "user.id",
    "user.email",
    "user.username",
    "user.ip",
]


class AIConversationDetailsResponse(TypedDict):
    """Span page plus conversation-level metadata."""

    conversationId: str
    title: str | None
    spans: list[dict[str, Any]]


@extend_schema(tags=["Explore"])
@cell_silo_endpoint
class OrganizationAIConversationDetailsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {"GET": ApiPublishStatus.PUBLIC}
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    @extend_schema(
        operation_id="retrieveOrganizationAIConversation",
        summary="Retrieve an Organization's AI Conversation",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            AI_CONVERSATION_ID_PARAM,
            OrganizationParams.PROJECT,
            GlobalParams.ENVIRONMENT,
            GlobalParams.STATS_PERIOD,
            GlobalParams.START,
            GlobalParams.END,
            CursorQueryParam,
            AI_CONVERSATION_DETAILS_PER_PAGE_PARAM,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "RetrieveOrganizationAIConversationResponse", AIConversationDetailsResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=AIConversationExamples.RETRIEVE_AI_CONVERSATION,
    )
    def get(
        self, request: Request, organization: Organization, conversation_id: str
    ) -> Response[AIConversationDetailsResponse] | Response[DetailResponse] | Response[None]:
        """Return spans recorded for one AI conversation in start-time order.

        **Experimental:** This API is under active development and may change.

        Message, tool, and response attributes contain their recorded string values.
        Without an explicit range, Sentry widens the search across available retention.
        A missing conversation returns an empty `spans` list.
        """
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        now = timezone.now()
        max_retention_cutoff = now - timedelta(days=MAX_RETENTION_DAYS)
        has_explicit_range = request.GET.get("start") or request.GET.get("end")

        if has_explicit_range:
            if snuba_params.start and snuba_params.start < max_retention_cutoff:
                error = DetailResponse(
                    detail=f"start time cannot be older than {MAX_RETENTION_DAYS} days"
                )
                return Response(error, status=400)
            if snuba_params.end and snuba_params.end < max_retention_cutoff:
                error = DetailResponse(
                    detail=f"end time cannot be older than {MAX_RETENTION_DAYS} days"
                )
                return Response(error, status=400)

        with handle_query_errors():
            if has_explicit_range:
                resolved_params = snuba_params
            else:
                resolved_params = self._resolve_time_window(
                    snuba_params, request.GET.get("statsPeriod"), now, conversation_id
                )

            def data_fn(offset: int, limit: int) -> list[SpanRow]:
                return self._fetch_spans(resolved_params, conversation_id, offset, limit)

            def on_results(spans: list[SpanRow]) -> AIConversationDetailsResponse:
                self._repair_parent_links(spans, resolved_params, conversation_id)
                self._annotate_issues(spans, resolved_params, organization)
                return {
                    "conversationId": conversation_id,
                    "title": self._resolve_title(conversation_id, spans, organization),
                    "spans": spans,
                }

            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=on_results,
                default_per_page=100,
                max_per_page=1000,
            )

    def _resolve_time_window(
        self,
        base_params: SnubaParams,
        stats_period: str | None,
        now: datetime,
        conversation_id: str,
    ) -> SnubaParams:
        """Probe progressively wider windows to find which contains the conversation."""
        candidates = self._build_widening_params(base_params, stats_period, now)
        for params in candidates:
            if self._fetch_spans(params, conversation_id, offset=0, limit=1):
                return params
        return candidates[-1]

    def _build_widening_params(
        self, base_params: SnubaParams, stats_period: str | None, now: datetime
    ) -> list[SnubaParams]:
        max_retention = timedelta(days=MAX_RETENTION_DAYS)
        requested_delta: timedelta | None = (
            parse_stats_period(stats_period) if stats_period else None
        )

        steps: list[timedelta] = []
        if requested_delta and requested_delta < max_retention:
            steps.append(requested_delta)
        for step in _WIDENING_STEPS:
            if not steps or step > steps[-1]:
                steps.append(step)

        return [replace(base_params, start=now - delta, end=now) for delta in steps]

    @trace
    def _resolve_title(
        self,
        conversation_id: str,
        spans: Sequence[Mapping[str, Any]],
        organization: Organization,
    ) -> str | None:
        """Stored title for this conversation, or None when there is none yet.

        Titles are keyed per project, so they are looked up against the projects of the
        spans on this page; a conversation id titled in several projects can therefore
        report a different title on a later page. Best-effort: a failed lookup must not
        break listing the spans.
        """
        project_ids = {
            project_id for span in spans if isinstance(project_id := span.get("project.id"), int)
        }
        if not project_ids:
            return None

        try:
            stored_title = fetch_conversation_title(conversation_id, project_ids)
        except Exception:
            logger.exception(
                "Failed to resolve title for AI conversation",
                extra={"organization_id": organization.id},
            )
            return None

        return stored_title.title if stored_title else None

    @trace
    def _annotate_issues(
        self,
        spans: list[SpanRow],
        snuba_params: SnubaParams,
        organization: Organization,
    ) -> None:
        """Attach linked error/occurrence issues to each span, keyed by span id.

        Best-effort: a failure to resolve issues must not break listing the conversation
        spans, so each span always ends up with ``errors``/``occurrences`` arrays.
        """
        for span in spans:
            span.setdefault("errors", [])
            span.setdefault("occurrences", [])

        if not spans:
            return

        span_meta_by_id: dict[str, SpanIssueMeta] = {}
        trace_ids: list[str] = []
        for span in spans:
            span_id = span.get("span_id")
            if not span_id:
                continue
            span_meta_by_id[span_id] = SpanIssueMeta(
                start_timestamp=span.get("precise.start_ts", 0.0),
                end_timestamp=span.get("precise.finish_ts", 0.0),
                project_slug=span.get("project", ""),
                transaction=span.get("transaction", ""),
            )
            trace = span.get("trace")
            if trace:
                trace_ids.append(trace)

        if not trace_ids:
            return

        try:
            issues_by_span = get_issues_by_span_for_traces(
                snuba_params=snuba_params,
                trace_ids=trace_ids,
                organization=organization,
                referrer=Referrer.API_AI_CONVERSATION_DETAILS_ISSUES.value,
                span_meta_by_id=span_meta_by_id,
            )
        except Exception:
            logger.exception(
                "Failed to resolve issues for AI conversation spans",
                extra={"organization_id": organization.id},
            )
            return

        for span in spans:
            bucket = issues_by_span.get(span.get("span_id", ""))
            if bucket:
                span["errors"] = bucket["errors"]
                span["occurrences"] = bucket["occurrences"]

    def _is_gen_ai_span(self, span: Mapping[str, Any]) -> bool:
        if span.get("gen_ai.operation.type"):
            return True
        return any(
            isinstance(value := span.get(field), str) and value.startswith("gen_ai.")
            for field in ("span.op", "span.name")
        )

    def _span_key(self, span: Mapping[str, Any], id_field: str = "span_id") -> SpanKey | None:
        trace_id = span.get("trace")
        span_id = span.get(id_field)
        if not isinstance(trace_id, str) or not isinstance(span_id, str) or not span_id:
            return None
        return trace_id, span_id

    def _fetch_parent_spans(
        self,
        snuba_params: SnubaParams,
        parent_keys: Collection[SpanKey],
    ) -> dict[SpanKey, SpanRow]:
        if not parent_keys:
            return {}

        requested_keys = set(parent_keys)
        query_string = " OR ".join(
            f"({build_escaped_term_filter('trace', [trace_id])} "
            f"{build_escaped_term_filter('span_id', [span_id])})"
            for trace_id, span_id in sorted(requested_keys)
        )
        result = Spans.run_table_query(
            params=snuba_params,
            query_string=query_string,
            selected_columns=PARENT_SPAN_ATTRIBUTES,
            orderby=[],
            offset=0,
            limit=len(requested_keys),
            referrer=Referrer.API_AI_CONVERSATION_DETAILS.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode="HIGHEST_ACCURACY",
        )

        return {
            key: row
            for row in result.get("data", [])
            if (key := self._span_key(row)) in requested_keys
        }

    def _repair_parent_links(
        self, spans: list[SpanRow], snuba_params: SnubaParams, conversation_id: str
    ) -> None:
        anchors: set[SpanKey] = set()
        for span in spans:
            if span.get("gen_ai.conversation.id") != conversation_id or not self._is_gen_ai_span(
                span
            ):
                continue
            if (key := self._span_key(span)) is not None:
                anchors.add(key)

        pending: dict[SpanKey, tuple[SpanRow, SpanKey, set[SpanKey]]] = {}
        for span in spans:
            child_key = self._span_key(span)
            parent_key = self._span_key(span, "parent_span")
            if (
                child_key is not None
                and parent_key is not None
                and parent_key != child_key
                and parent_key not in anchors
                and span.get("gen_ai.conversation.id") == conversation_id
                and self._is_gen_ai_span(span)
            ):
                pending[child_key] = (span, parent_key, {child_key})

        cache: dict[SpanKey, SpanRow] = {}
        fetched_keys: set[SpanKey] = set()
        for depth in range(1, MAX_PARENT_REPAIR_DEPTH + 1):
            if not pending:
                break

            missing_keys = {parent_key for _, parent_key, _ in pending.values()} - fetched_keys
            fetched_keys.update(missing_keys)
            try:
                cache.update(self._fetch_parent_spans(snuba_params, missing_keys))
            except Exception:
                logger.exception("Failed to repair AI conversation span parents")
                return
            next_pending: dict[SpanKey, tuple[SpanRow, SpanKey, set[SpanKey]]] = {}

            for child_key, (child, parent_key, visited) in pending.items():
                parent = cache.get(parent_key)
                if parent is None:
                    continue

                repair_depth = depth
                if parent.get("gen_ai.conversation.id") == conversation_id and self._is_gen_ai_span(
                    parent
                ):
                    ancestor_key = parent_key
                else:
                    next_ancestor_key = self._span_key(parent, "parent_span")
                    repair_depth += 1
                    visited = visited | {parent_key}
                    if next_ancestor_key is None or next_ancestor_key in visited:
                        continue
                    if repair_depth > MAX_PARENT_REPAIR_DEPTH:
                        metrics.incr("ai_monitoring.conversation_details.parent_repair_max_depth")
                        continue
                    if next_ancestor_key not in anchors:
                        next_pending[child_key] = (child, next_ancestor_key, visited)
                        continue
                    ancestor_key = next_ancestor_key

                if child.get("parent_span") != ancestor_key[1]:
                    child["parent_span"] = ancestor_key[1]
                    metrics.distribution(
                        "ai_monitoring.conversation_details.parent_repair_depth", repair_depth
                    )

            pending = next_pending

    @trace
    def _fetch_spans(
        self,
        snuba_params: SnubaParams,
        conversation_id: str,
        offset: int,
        limit: int,
    ) -> list[SpanRow]:
        result = Spans.run_table_query(
            params=snuba_params,
            query_string=build_escaped_term_filter("gen_ai.conversation.id", [conversation_id]),
            selected_columns=AI_CONVERSATION_ATTRIBUTES,
            orderby=["precise.start_ts"],
            offset=offset,
            limit=limit,
            referrer=Referrer.API_AI_CONVERSATION_DETAILS.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode="HIGHEST_ACCURACY",
        )
        return result.get("data", [])
