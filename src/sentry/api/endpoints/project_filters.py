from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers.models.project_filters import ProjectFiltersResponse
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.ingest import inbound_filters


@extend_schema(tags=["Projects"])
@region_silo_endpoint
class ProjectFiltersEndpoint(ProjectEndpoint):
    owner = ApiOwner.UNOWNED
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="List a Project's Filters",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer(
                "ProjectFiltersResponse", ProjectFiltersResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
        },
    )
    def get(self, request: Request, project) -> Response:
        """
        List a project's filters

        Retrieve a list of filters for a given project.

            {method} {path}

        """
        results = []
        for flt in inbound_filters.get_all_filter_specs():
            results.append(
                {
                    "id": flt.id,
                    # 'active' will be either a boolean or list for the legacy browser filters
                    # all other filters will be boolean
                    "active": inbound_filters.get_filter_state(flt.id, project),
                }
            )
        results.sort(key=lambda x: x["id"])
        return Response(results)
