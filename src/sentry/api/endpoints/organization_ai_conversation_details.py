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
from sentry.utils.iterators import chunked
from sentry.utils.tracing import trace

logger = logging.getLogger(__name__)

MAX_RETENTION_DAYS = 30

_WIDENING_STEPS = [timedelta(days=7), timedelta(days=14), timedelta(days=MAX_RETENTION_DAYS)]

CONVERSATION_PARENT_SPAN = "conversation_parent_span"

# How many generations of missing ancestors to look up. Gaps observed in real data
# are a single span, so this leaves room to spare without unbounded round trips.
MAX_ANCESTOR_GENERATIONS = 4

# Span ids per ancestor lookup. Each id is a point lookup, but the query string
# holds them all, so keep any single one a reasonable size.
MAX_ANCESTORS_PER_QUERY = 500

ANCESTOR_ATTRIBUTES = ["span_id", "parent_span", "trace", "gen_ai.conversation.id"]

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
        rebuild the agent tree. Looking the missing ancestors up here restores it.

        Membership is read from each ancestor's own conversation id rather than from
        this page, so an ancestor returned on a later page still resolves.

        Best-effort: an unresolved chain leaves ``conversation_parent_span`` null,
        which is what the client already handles.
        """
        for span in spans:
            span.setdefault(CONVERSATION_PARENT_SPAN, None)

        if not spans:
            return

        # Every span we know the parent of. None means "no parent, or never found".
        parent_of: dict[SpanKey, str | None] = {}
        in_conversation: set[SpanKey] = set()
        page: list[tuple[dict, SpanKey]] = []

        for span in spans:
            key = self._span_key(span)
            if key is None:
                continue
            parent_of[key] = span.get("parent_span") or None
            in_conversation.add(key)
            page.append((span, key))

        try:
            for _ in range(MAX_ANCESTOR_GENERATIONS):
                # Only chains that have not reached an ancestor in the conversation
                # need another hop, so a span stops costing lookups once it resolves.
                wanted: set[SpanKey] = set()
                for _span, key in page:
                    _ancestor, missing = self._walk_ancestors(key, parent_of, in_conversation)
                    if missing is not None:
                        wanted.add((key[0], missing))
                if not wanted:
                    break

                for row in self._fetch_ancestors(snuba_params, wanted):
                    key = self._span_key(row)
                    if key is None:
                        continue
                    parent_of[key] = row.get("parent_span") or None
                    if row.get("gen_ai.conversation.id") == conversation_id:
                        in_conversation.add(key)

                # Whatever did not come back is outside the queried window. Mark it
                # so the next generation does not ask for it again.
                for key in wanted:
                    parent_of.setdefault(key, None)
        except Exception:
            logger.exception(
                "Failed to resolve ancestors for AI conversation spans",
                extra={"conversation_id": conversation_id},
            )

        for span, key in page:
            ancestor, _missing = self._walk_ancestors(key, parent_of, in_conversation)
            span[CONVERSATION_PARENT_SPAN] = ancestor

    @staticmethod
    def _span_key(span: Mapping[str, Any]) -> SpanKey | None:
        trace = span.get("trace")
        span_id = span.get("span_id")
        return (trace, span_id) if trace and span_id else None

    @staticmethod
    def _walk_ancestors(
        key: SpanKey,
        parent_of: Mapping[SpanKey, str | None],
        in_conversation: set[SpanKey],
    ) -> tuple[str | None, str | None]:
        """Walk up from a span as far as the known parent links allow.

        Returns ``(ancestor, missing)``. ``ancestor`` is the nearest ancestor that
        belongs to the conversation, and is None when the chain ends without one.
        ``missing`` is the first ancestor that has not been looked up yet, and is
        None once the walk has seen every link the trace records.
        """
        trace, span_id = key
        visited = {span_id}
        current = parent_of.get(key)

        while current and current not in visited:
            visited.add(current)
            ancestor = (trace, current)
            if ancestor in in_conversation:
                return current, None
            if ancestor not in parent_of:
                return None, current
            current = parent_of[ancestor]

        return None, None

    @trace
    def _fetch_ancestors(
        self, snuba_params: SnubaParams, keys: set[SpanKey]
    ) -> list[dict[str, Any]]:
        """Look the given spans up by id. ``span_id`` is the item id, so these are
        point lookups rather than a scan of the traces."""
        trace_filter = f"trace:[{','.join(sorted({trace for trace, _ in keys}))}]"
        span_ids = sorted({span_id for _, span_id in keys})

        rows: list[dict[str, Any]] = []
        for chunk in chunked(span_ids, MAX_ANCESTORS_PER_QUERY):
            result = Spans.run_table_query(
                params=snuba_params,
                query_string=f"{trace_filter} span_id:[{','.join(chunk)}]",
                selected_columns=ANCESTOR_ATTRIBUTES,
                orderby=None,
                offset=0,
                limit=len(chunk),
                referrer=Referrer.API_AI_CONVERSATION_DETAILS_ANCESTORS.value,
                config=SearchResolverConfig(auto_fields=True),
                sampling_mode="HIGHEST_ACCURACY",
            )
            rows.extend(result.get("data", []))
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
