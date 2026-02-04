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
from sentry.search.utils import parse_datetime_string
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.utils.dates import parse_stats_period

MAX_ALLOWED_PERIOD = timedelta(days=30)

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

        mutable_query = request.GET.copy()

        start_param = request.GET.get("start")
        end_param = request.GET.get("end")
        stats_period = request.GET.get("statsPeriod")

        now = timezone.now()

        # Validate in the same order as get_date_range_from_stats_period to ensure
        # we validate the parameter that will actually be used for the query.
        # The precedence is: statsPeriod > start/end > default
        if stats_period:
            parsed_period = parse_stats_period(stats_period)
            if parsed_period is None:
                return Response(
                    {"detail": f"Invalid statsPeriod: {stats_period!r}"},
                    status=400,
                )
            if parsed_period > MAX_ALLOWED_PERIOD:
                return Response(
                    {
                        "detail": "statsPeriod cannot exceed 30 days. Data is sampled beyond this period."
                    },
                    status=400,
                )
        elif start_param and end_param:
            try:
                start_dt = parse_datetime_string(start_param)
                end_dt = parse_datetime_string(end_param)
            except Exception:
                return Response(
                    {"detail": "Invalid start or end date format."},
                    status=400,
                )

            if start_dt < now - MAX_ALLOWED_PERIOD:
                return Response(
                    {
                        "detail": "Cannot query data older than 30 days. Data is sampled beyond this period."
                    },
                    status=400,
                )

            if end_dt - start_dt > MAX_ALLOWED_PERIOD:
                return Response(
                    {
                        "detail": "Date range cannot exceed 30 days. Data is sampled beyond this period."
                    },
                    status=400,
                )
        else:
            # Default to 30d if no time parameters provided
            mutable_query["statsPeriod"] = "30d"
            request.GET = mutable_query  # type: ignore[assignment]

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

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
