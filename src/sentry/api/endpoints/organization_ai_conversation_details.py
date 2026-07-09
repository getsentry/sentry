import logging
from dataclasses import replace
from datetime import datetime, timedelta

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
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
    "gen_ai.usage.total_tokens",
    "gen_ai.request.model",
    "gen_ai.response.model",
    "gen_ai.agent.name",
    "user.id",
    "user.email",
    "user.username",
    "user.ip",
]


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
                return spans

            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
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
