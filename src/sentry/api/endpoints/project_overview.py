from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.permissions import StaffPermissionMixin
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import ProjectSerializer
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.project_examples import ProjectExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.models.project import Project


class RelaxedProjectPermission(ProjectPermission):
    scope_map = {
        "GET": ["project:read", "project:write", "project:admin"],
    }


class RelaxedProjectAndStaffPermission(StaffPermissionMixin, RelaxedProjectPermission):
    pass


@extend_schema(tags=["Projects"])
@region_silo_endpoint
class ProjectOverviewEndpoint(ProjectEndpoint):
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (RelaxedProjectAndStaffPermission,)

    @extend_schema(
        operation_id="Retrieve a Project overview",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=None,
        responses={
            200: ProjectSerializer,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ProjectExamples.OVERVIEW_PROJECT,
        summary=(
            "Retrieve a Project overview. This endpoint returns an overview of an individual "
            "project. This only returns high-level information of the project, for more detailed "
            "information use the project details endpoint."
        ),
    )
    def get(self, request: Request, project: Project) -> Response:
        """
        Return details on an individual project.
        """
        data = serialize(project, request.user, ProjectSerializer())
        return Response(data)
