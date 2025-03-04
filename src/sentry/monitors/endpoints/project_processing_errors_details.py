from __future__ import annotations

from uuid import UUID

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectAlertRulePermission, ProjectEndpoint
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, MonitorParams
from sentry.models.project import Project
from sentry.monitors.processing_errors.manager import InvalidProjectError, delete_error


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class ProjectProcessingErrorsDetailsEndpoint(ProjectEndpoint):
    permission_classes: tuple[type[BasePermission], ...] = (ProjectAlertRulePermission,)

    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Delete a processing error for a Monitor",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            MonitorParams.PROCESSING_ERROR_ID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, project: Project, uuid: str) -> Response:
        try:
            parsed_uuid = UUID(uuid)
        except ValueError:
            raise ValidationError("Invalid UUID")
        try:
            delete_error(project, parsed_uuid)
        except InvalidProjectError:
            raise ValidationError("Invalid uuid for project")
        return self.respond(status=204)
