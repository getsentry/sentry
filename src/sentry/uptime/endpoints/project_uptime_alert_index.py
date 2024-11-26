from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.api.bases.project import ProjectAlertRulePermission
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.models.project import Project
from sentry.uptime.endpoints.serializers import ProjectUptimeSubscriptionSerializer
from sentry.uptime.endpoints.validators import UptimeMonitorValidator


@region_silo_endpoint
@extend_schema(tags=["Uptime Monitors"])
class ProjectUptimeAlertIndexEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.CRONS
    permission_classes = (ProjectAlertRulePermission,)

    @extend_schema(
        operation_id="Create an Uptime Monitor",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=UptimeMonitorValidator,
        responses={
            201: ProjectUptimeSubscriptionSerializer,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(self, request: Request, project: Project) -> Response:
        """
        Create a new monitor.
        """
        validator = UptimeMonitorValidator(
            data=request.data,
            context={
                "organization": project.organization,
                "project": project,
                "access": request.access,
                "request": request,
            },
        )
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        return self.respond(serialize(validator.save(), request.user))
