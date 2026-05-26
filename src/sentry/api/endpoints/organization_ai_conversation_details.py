from dataclasses import replace
from datetime import datetime, timedelta

import sentry_sdk
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import TimeoutException, handle_query_errors
from sentry.models.organization import Organization
from sentry.search.eap.occurrences.query_utils import build_escaped_term_filter
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.dates import parse_stats_period

MAX_RETENTION_DAYS = 30

# Try progressively wider windows before giving up.
_WIDENING_STEPS = [timedelta(days=7), timedelta(days=MAX_RETENTION_DAYS)]

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

_TIMEOUT_DETAIL = "Query timed out. Try searching with a narrower time range."


@cell_silo_endpoint
class OrganizationAIConversationDetailsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def get(self, request: Request, organization: Organization, conversation_id: str) -> Response:
        if not features.has("organizations:gen-ai-conversations", organization, actor=request.user):
            return Response(status=404)

        stats_period = request.GET.get("statsPeriod")
        has_explicit_range = request.GET.get("start") or request.GET.get("end")

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        now = timezone.now()
        max_retention_cutoff = now - timedelta(days=MAX_RETENTION_DAYS)

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
            data_fn = self._make_direct_data_fn(snuba_params, conversation_id)
        else:
            params_sequence = self._build_widening_sequence(snuba_params, stats_period, now)
            data_fn = self._make_widening_data_fn(params_sequence, conversation_id)

        try:
            with handle_query_errors():
                return self.paginate(
                    request=request,
                    paginator=GenericOffsetPaginator(data_fn=data_fn),
                    default_per_page=100,
                    max_per_page=1000,
                )
        except TimeoutException:
            sentry_sdk.set_tag("ai_conversations.detail_timeout", True)
            return Response(
                {"detail": _TIMEOUT_DETAIL, "code": "query_timeout"},
                status=504,
            )

    def _build_widening_sequence(
        self, base_params: SnubaParams, stats_period: str | None, now: datetime
    ) -> list[SnubaParams]:
        # parse_stats_period returns None for invalid input; skip to default steps
        requested_delta = parse_stats_period(stats_period) if stats_period else None

        steps: list[timedelta] = []
        if requested_delta and requested_delta < timedelta(days=MAX_RETENTION_DAYS):
            steps.append(requested_delta)

        for step in _WIDENING_STEPS:
            if not steps or step > steps[-1]:
                steps.append(step)

        return [replace(base_params, start=now - delta, end=now) for delta in steps]

    def _make_direct_data_fn(self, snuba_params: SnubaParams, conversation_id: str):
        def data_fn(offset: int, limit: int) -> list:
            return self._fetch_conversation_spans(snuba_params, conversation_id, offset, limit)

        return data_fn

    def _make_widening_data_fn(self, params_sequence: list[SnubaParams], conversation_id: str):
        winning_params: SnubaParams | None = None

        def data_fn(offset: int, limit: int) -> list:
            nonlocal winning_params

            if winning_params is not None:
                return self._fetch_conversation_spans(
                    winning_params, conversation_id, offset, limit
                )

            for params in params_sequence:
                result = self._fetch_conversation_spans(params, conversation_id, offset, limit)
                if result:
                    winning_params = params
                    return result

            return []

        return data_fn

    @sentry_sdk.trace
    def _fetch_conversation_spans(
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
