from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.paginator import SequencePaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams, MonitorParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.monitors.endpoints.base import ProjectMonitorEndpoint
from sentry.monitors.processing_errors import (
    CheckinProcessErrorsManager,
    CheckinProcessingErrorData,
)
from sentry.utils.auth import AuthenticatedHttpRequest


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class ProjectMonitorProcessingErrorsIndexEndpoint(ProjectMonitorEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Retrieve checkin processing errors for a monitor",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            MonitorParams.MONITOR_ID_OR_SLUG,
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
    def get(self, request: AuthenticatedHttpRequest, project, monitor) -> Response:
        """
        Retrieves checkin processing errors for a monitor
        """
        paginator = SequencePaginator(
            list(enumerate(CheckinProcessErrorsManager().get_for_monitor(monitor)))
        )

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
        )
