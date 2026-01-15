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
    "gen_ai.operation.type",
    "gen_ai.request.messages",
    "gen_ai.response.text",
    "gen_ai.response.object",
    "gen_ai.tool.name",
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
