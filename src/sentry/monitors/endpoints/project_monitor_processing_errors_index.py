from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.paginator import SequencePaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, MonitorParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.project import Project
from sentry.monitors.models import Monitor
from sentry.monitors.processing_errors.errors import CheckinProcessingErrorData, ProcessingErrorType
from sentry.monitors.processing_errors.manager import (
    delete_errors_for_monitor_by_type,
    get_errors_for_monitor,
)
from sentry.utils.auth import AuthenticatedHttpRequest

from .base import ProjectMonitorEndpoint


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class ProjectMonitorProcessingErrorsIndexEndpoint(ProjectMonitorEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Retrieve checkin processing errors for a monitor",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
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
        paginator = SequencePaginator(list(enumerate(get_errors_for_monitor(monitor))))

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
        )

    @extend_schema(
        operation_id="Delete all processing errors by type for a Monitor",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            MonitorParams.MONITOR_ID_OR_SLUG,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self, request: AuthenticatedHttpRequest, project: Project, monitor: Monitor
    ) -> Response:
        try:
            error_type = ProcessingErrorType(int(request.GET.get("errortype", -1)))
        except ValueError:
            raise ValidationError("Invalid error type")

        delete_errors_for_monitor_by_type(monitor, error_type)
        return self.respond(status=204)
