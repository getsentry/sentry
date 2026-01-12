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
BASE_SPAN_COLUMNS = [
    "span_id",
    "trace",
    "parent_span",
    "precise.start_ts",
    "precise.finish_ts",
    "span.op",
    "span.status",
    "span.description",
    "gen_ai.conversation.id",
]


@region_silo_endpoint
class OrganizationAIConversationDetailsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.DATA_BROWSING

    def get(self, request: Request, organization: Organization, conversation_id: str) -> Response:
        if not features.has("organizations:gen-ai-conversations", organization, actor=request.user):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        additional_attributes = request.GET.getlist("additional_attributes", [])
        selected_columns = BASE_SPAN_COLUMNS + additional_attributes

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
