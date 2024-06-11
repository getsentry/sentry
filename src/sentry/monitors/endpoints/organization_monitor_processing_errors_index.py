from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import SequencePaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.monitors.processing_errors.errors import CheckinProcessingErrorData
from sentry.monitors.processing_errors.manager import get_errors_for_projects
from sentry.utils.auth import AuthenticatedHttpRequest


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class OrganizationMonitorProcessingErrorsIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Retrieve checkin processing errors for an Organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "CheckinProcessingError", list[CheckinProcessingErrorData]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: AuthenticatedHttpRequest, organization: Organization) -> Response:
        """
        Retrieves checkin processing errors for an organization
        """
        projects = self.get_projects(request, organization)
        paginator = SequencePaginator(list(enumerate(get_errors_for_projects(projects))))

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
        )
