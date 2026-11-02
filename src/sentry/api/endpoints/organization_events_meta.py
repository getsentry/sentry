from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.utils import handle_query_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.search.eap.types import SearchResolverConfig
from sentry.snuba.referrer import Referrer
from sentry.snuba.utils import RPC_DATASETS


class OrganizationEventsMetaResponse(TypedDict):
    count: int


@cell_silo_endpoint
class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationEventsMetaResponse", OrganizationEventsMetaResponse
            )
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[OrganizationEventsMetaResponse]:
        try:
            snuba_params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response({"count": 0})

        dataset = self.get_dataset(request, organization)

        with handle_query_errors():
            if dataset in RPC_DATASETS:
                result = dataset.run_table_query(
                    params=snuba_params,
                    query_string=request.query_params.get("query"),
                    selected_columns=["count()"],
                    orderby=None,
                    offset=0,
                    limit=1,
                    referrer=Referrer.API_ORGANIZATION_EVENTS_META,
                    config=SearchResolverConfig(),
                )

                return Response({"count": result["data"][0]["count()"]})
            else:
                result = dataset.query(
                    selected_columns=["count()"],
                    snuba_params=snuba_params,
                    query=request.query_params.get("query"),
                    referrer=Referrer.API_ORGANIZATION_EVENTS_META.value,
                    has_metrics=True,
                    # TODO: @athena - add query_source when all datasets support it
                    # query_source=(
                    #     QuerySource.FRONTEND if is_frontend_request(request) else QuerySource.API
                    # ),
                    fallback_to_transactions=True,
                )

                return Response({"count": result["data"][0]["count"]})
