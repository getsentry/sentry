from __future__ import annotations

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
from sentry.apidocs.parameters import GlobalParams
from sentry.models.project import Project
from sentry.monitors.processing_errors.errors import ProcessingErrorType
from sentry.monitors.processing_errors.manager import delete_errors_for_project_by_type


@region_silo_endpoint
@extend_schema(tags=["Crons"])
class ProjectProcessingErrorsIndexEndpoint(ProjectEndpoint):
    permission_classes: tuple[type[BasePermission], ...] = (ProjectAlertRulePermission,)

    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.CRONS

    @extend_schema(
        operation_id="Delete all processing errors by type for a Project",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(self, request: Request, project: Project) -> Response:
        try:
            error_type = ProcessingErrorType(int(request.GET.get("errortype", -1)))
        except ValueError:
            raise ValidationError("Invalid error type")

        delete_errors_for_project_by_type(project, error_type)
        return self.respond(status=204)
