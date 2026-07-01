import logging

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
    resolve_conversation_time_window,
    retention_window_error,
)
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace import SpanIssueMeta, get_issues_by_span_for_traces

logger = logging.getLogger(__name__)

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
        has_explicit_range = request.GET.get("start") or request.GET.get("end")

        if has_explicit_range:
            error = retention_window_error(snuba_params, now)
            if error:
                return Response({"detail": error}, status=400)

        with handle_query_errors():
            if has_explicit_range:
                resolved_params = snuba_params
            else:
                resolved_params = resolve_conversation_time_window(
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

    @sentry_sdk.trace
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

    @sentry_sdk.trace
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
