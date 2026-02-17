from datetime import timedelta

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

MAX_RETENTION_DAYS = 30

# Base span fields always returned
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
    "gen_ai.usage.total_tokens",
    "user.id",
    "user.email",
    "user.username",
    "user.ip",
]


@region_silo_endpoint
class OrganizationAIConversationDetailsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def get(self, request: Request, organization: Organization, conversation_id: str) -> Response:
        if not features.has("organizations:gen-ai-conversations", organization, actor=request.user):
            return Response(status=404)

        # Check what date params were passed before calling get_snuba_params
        stats_period = request.GET.get("statsPeriod")
        has_explicit_range = request.GET.get("start") or request.GET.get("end")

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        # Enforce 30-day retention limit
        max_retention = timedelta(days=MAX_RETENTION_DAYS)
        now = timezone.now()
        max_retention_cutoff = now - max_retention

        if stats_period or not has_explicit_range:
            # Always use full 30d range when statsPeriod is passed or no date params
            snuba_params.start = max_retention_cutoff
            snuba_params.end = now
        else:
            # Validate explicit start/end aren't older than retention limit
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

        selected_columns = AI_CONVERSATION_ATTRIBUTES

        def data_fn(offset: int, limit: int):
            return self._fetch_conversation_spans(
                snuba_params=snuba_params,
                conversation_id=conversation_id,
                selected_columns=selected_columns,
                offset=offset,
                limit=limit,
            )

        with handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                default_per_page=100,
                max_per_page=1000,
            )

    def _fetch_conversation_spans(
        self,
        snuba_params,
        conversation_id: str,
        selected_columns: list[str],
        offset: int,
        limit: int,
    ):
        result = Spans.run_table_query(
            params=snuba_params,
            query_string=f"gen_ai.conversation.id:{conversation_id}",
            selected_columns=selected_columns,
            orderby=["precise.start_ts"],
            offset=offset,
            limit=limit,
            referrer=Referrer.API_AI_CONVERSATION_DETAILS.value,
            config=SearchResolverConfig(auto_fields=True),
            sampling_mode="HIGHEST_ACCURACY",
        )
        return result.get("data", [])
