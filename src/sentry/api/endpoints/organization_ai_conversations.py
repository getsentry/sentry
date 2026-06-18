from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.helpers.ai_conversations_columns import (
    get_conversations_columns,
    resolve_requested_fields,
)
from sentry.api.helpers.ai_conversations_legacy import get_conversations
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers.rest_framework import OrganizationAIConversationsSerializer
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.search.events.types import SAMPLING_MODES, SnubaParams


@cell_silo_endpoint
class OrganizationAIConversationsEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.DATA_BROWSING

    def get(self, request: Request, organization: Organization) -> Response:
        if not features.has("organizations:gen-ai-conversations", organization, actor=request.user):
            return Response(status=404)

        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        if features.has(
            "organizations:gen-ai-conversations-columns", organization, actor=request.user
        ):
            data_fn = self._columns_data_fn(request, organization, snuba_params)
        else:
            serializer = OrganizationAIConversationsSerializer(data=request.GET)
            if not serializer.is_valid():
                return Response(serializer.errors, status=400)
            data_fn = self._legacy_data_fn(snuba_params, serializer.validated_data)

        with handle_query_errors():
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=lambda results: results,
                default_per_page=10,
                max_per_page=100,
            )

    def _columns_data_fn(
        self, request: Request, organization: Organization, snuba_params: SnubaParams
    ):
        fields = resolve_requested_fields(self.get_field_list(organization, request))
        # Default matches the legacy serializer so sampling behaves identically.
        sampling_mode: SAMPLING_MODES = snuba_params.sampling_mode or "HIGHEST_ACCURACY"

        def data_fn(offset: int, limit: int):
            return get_conversations_columns(
                snuba_params,
                fields=fields,
                sampling_mode=sampling_mode,
                offset=offset,
                limit=limit,
            )

        return data_fn

    def _legacy_data_fn(self, snuba_params: SnubaParams, validated_data: dict):
        def data_fn(offset: int, limit: int):
            return get_conversations(
                snuba_params,
                offset=offset,
                limit=limit,
                user_query=validated_data.get("query", ""),
                sampling_mode=validated_data.get("samplingMode", "NORMAL"),
            )

        return data_fn
