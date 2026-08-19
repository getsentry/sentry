import logging
from collections.abc import Mapping, Sequence
from dataclasses import replace
from datetime import datetime, timedelta
from typing import Any, TypedDict

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.ai_monitoring.utils import fetch_conversation_title
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace import SpanIssueMeta, get_issues_by_span_for_traces
from sentry.utils.dates import parse_stats_period
from sentry.utils.tracing import trace

logger = logging.getLogger(__name__)

MAX_RETENTION_DAYS = 30

_WIDENING_STEPS = [timedelta(days=7), timedelta(days=14), timedelta(days=MAX_RETENTION_DAYS)]

CONVERSATION_PARENT_SPAN = "conversation_parent_span"

# Rows per page of the parent-link query, and the total it will read. A trace can
# hold far more spans than this, so the cap bounds the work at the cost of leaving
# some parents unresolved on very large traces.
TRACE_LINK_PAGE_SIZE = 10_000
MAX_TRACE_LINK_ROWS = 20_000

TRACE_LINK_ATTRIBUTES = ["span_id", "parent_span", "trace", "gen_ai.conversation.id"]

# A span, identified within its trace. Span ids are only unique per trace.
SpanKey = tuple[str, str]

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


@cell_silo_endpoint
class OrganizationAIConversationDetailsEndpoint(OrganizationEventsEndpointBase):
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
        max_retention_cutoff = now - timedelta(days=MAX_RETENTION_DAYS)
        has_explicit_range = request.GET.get("start") or request.GET.get("end")

        if has_explicit_range:
            if snuba_params.start and snuba_params.start < max_retention_cutoff:
                return Response(
                    {"detail": f"start time cannot be older than {MAX_RETENTION_DAYS} days"},
                    status=400,
                )
            if snuba_params.end and snuba_params.end < max_retention_cutoff:
                return Response(
                    {"detail": f"end time cannot be older than {MAX_RETENTION_DAYS} days"},
                    status=400,
                )

        with handle_query_errors():
            if has_explicit_range:
                resolved_params = snuba_params
            else:
                resolved_params = self._resolve_time_window(
                    snuba_params, request.GET.get("statsPeriod"), now, conversation_id
                )

            def data_fn(offset: int, limit: int) -> list:
                spans = self._fetch_spans(resolved_params, conversation_id, offset, limit)
                self._annotate_issues(spans, resolved_params, organization)
                self._annotate_conversation_parents(spans, resolved_params, conversation_id)
                return spans

            def on_results(spans: list[dict[str, Any]]) -> AIConversationDetailsResponse:
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
        spans: list[dict],
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

    @trace
    def _annotate_conversation_parents(
        self,
        spans: list[dict],
        snuba_params: SnubaParams,
        conversation_id: str,
    ) -> None:
        """Attach each span's nearest ancestor that belongs to this conversation.

        A span carries a conversation id only where the SDK instruments it as a gen_ai
        span, so an agent and the span it produced are routinely separated by ordinary
        db or http spans. Those spans are not in this response, which leaves
        ``parent_span`` pointing at a span the client does not have and no way to
        rebuild the agent tree. Reading the parent links of every span in the
        conversation's traces restores it.

        Membership is read from each span's own conversation id rather than from this
        page, so an ancestor returned on a later page still resolves.

        Best-effort: an unresolved chain leaves ``conversation_parent_span`` null,
        which is what the client already handles.
        """
        for span in spans:
            span.setdefault(CONVERSATION_PARENT_SPAN, None)

        page: list[tuple[dict, SpanKey]] = []
        trace_ids: set[str] = set()
        for span in spans:
            key = self._span_key(span)
            if key is None:
                continue
            page.append((span, key))
            trace_ids.add(key[0])

        if not trace_ids:
            return

        # Every span we know the parent of. None means "no parent".
        parent_of: dict[SpanKey, str | None] = {}
        in_conversation: set[SpanKey] = set()

        try:
            rows = self._fetch_trace_links(snuba_params, trace_ids)
        except Exception:
            logger.exception(
                "Failed to read parent links for AI conversation spans",
                extra={"conversation_id": conversation_id},
            )
            rows = []

        for row in rows:
            key = self._span_key(row)
            if key is None:
                continue
            parent_of[key] = row.get("parent_span") or None
            if row.get("gen_ai.conversation.id") == conversation_id:
                in_conversation.add(key)

        # The page is authoritative for its own spans, which matters when the link
        # query was truncated or a span landed outside its window.
        for span, key in page:
            parent_of[key] = span.get("parent_span") or None
            in_conversation.add(key)

        for span, key in page:
            span[CONVERSATION_PARENT_SPAN] = self._nearest_conversation_ancestor(
                key, parent_of, in_conversation
            )

    @staticmethod
    def _span_key(span: Mapping[str, Any]) -> SpanKey | None:
        trace = span.get("trace")
        span_id = span.get("span_id")
        return (trace, span_id) if trace and span_id else None

    @staticmethod
    def _nearest_conversation_ancestor(
        key: SpanKey,
        parent_of: Mapping[SpanKey, str | None],
        in_conversation: set[SpanKey],
    ) -> str | None:
        """The closest ancestor of a span that belongs to the conversation, walking
        up through spans that do not, or None when the chain holds none."""
        trace, span_id = key
        visited = {span_id}
        current = parent_of.get(key)

        while current and current not in visited:
            visited.add(current)
            ancestor = (trace, current)
            if ancestor in in_conversation:
                return current
            current = parent_of.get(ancestor)

        return None

    @trace
    def _fetch_trace_links(
        self, snuba_params: SnubaParams, trace_ids: set[str]
    ) -> list[dict[str, Any]]:
        """Parent link of every span in the given traces, not only the gen_ai ones.

        Reads at most ``MAX_TRACE_LINK_ROWS``. Large traces run past that, which
        leaves the parents beyond it unresolved rather than growing the query without
        bound, so a truncated read is logged.
        """
        query_string = f"trace:[{','.join(sorted(trace_ids))}]"

        rows: list[dict[str, Any]] = []
        while len(rows) < MAX_TRACE_LINK_ROWS:
            result = Spans.run_table_query(
                params=snuba_params,
                query_string=query_string,
                selected_columns=TRACE_LINK_ATTRIBUTES,
                # Offset paging needs a total order, and span_id is already selected.
                orderby=["span_id"],
                offset=len(rows),
                limit=min(TRACE_LINK_PAGE_SIZE, MAX_TRACE_LINK_ROWS - len(rows)),
                referrer=Referrer.API_AI_CONVERSATION_DETAILS_TRACE_LINKS.value,
                config=SearchResolverConfig(auto_fields=True),
                sampling_mode="HIGHEST_ACCURACY",
            )
            page = result.get("data", [])
            rows.extend(page)
            if len(page) < TRACE_LINK_PAGE_SIZE:
                return rows

        logger.warning(
            "Truncated the parent link read for an AI conversation",
            extra={"trace_count": len(trace_ids), "rows": len(rows)},
        )
        return rows

    @trace
    def _fetch_spans(
        self,
        snuba_params: SnubaParams,
        conversation_id: str,
        offset: int,
        limit: int,
    ) -> list:
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
