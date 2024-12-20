from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.apidocs.constants import RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams


@region_silo_endpoint
class SharedDashboardDetailsEndpoint(Endpoint):
    owner = ApiOwner.PERFORMANCE
    # publish_status = {
    #     "GET": ApiPublishStatus.UNKNOWN,
    # }
    permission_classes = ()

    @extend_schema(
        operation_id="Retrieve an Organization's Custom Dashboard",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(name="share_id", type=str),
        ],
        responses={
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization_id_or_slug: int | str | None = None,
        share_id: str | None = None,
    ) -> Response:
        """
        Retrieve a shared dashboard
        """
        # print("shared dashboard endpoint")

        # dashboard = Dashboard.objects.first()
        data = []
        # data = serialize(
        #     dashboard, request.user, serializer=SharedDashboardDetailsModelSerializer()
        # )
        return self.respond(data)
