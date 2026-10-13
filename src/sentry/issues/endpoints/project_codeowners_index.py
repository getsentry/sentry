import sentry_sdk
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.analytics.events.codeowners_created import CodeOwnersCreated
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.projectcodeowners import (
    DEFAULT_CODEOWNERS_EXPAND,
    ProjectCodeOwnersResponse,
    ProjectCodeOwnersSerializer,
)
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples import codeowners_examples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.issues.endpoints.bases.codeowners import ProjectCodeOwnersBase
from sentry.issues.endpoints.serializers import (
    ProjectCodeOwnersCreateRequestSerializer,
    ProjectCodeOwnerSerializer,
)
from sentry.models.project import Project
from sentry.models.projectcodeowners import ProjectCodeOwners


@cell_silo_endpoint
@extend_schema(tags=["Projects"])
class ProjectCodeOwnersEndpoint(ProjectCodeOwnersBase):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="listProjectCodeOwners",
        summary="List a Project's CODEOWNERS Configurations",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            OpenApiParameter(
                name="expand",
                location=OpenApiParameter.QUERY,
                required=False,
                many=True,
                type=str,
                enum=["codeMapping", "ownershipSyntax"],
                description="Optional fields to expand.",
            ),
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ProjectCodeOwnersList", list[ProjectCodeOwnersResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=codeowners_examples.LIST_PROJECT_CODEOWNERS,
    )
    def get(self, request: Request, project: Project) -> Response[list[ProjectCodeOwnersResponse]]:
        """Return the CODEOWNERS configurations for a project."""
        if not self.has_feature(request, project):
            raise PermissionDenied

        expand = [*request.GET.getlist("expand", []), *DEFAULT_CODEOWNERS_EXPAND]

        codeowners: list[ProjectCodeOwners] = list(
            ProjectCodeOwners.objects.filter(project=project).order_by("-date_added")
        )

        body: list[ProjectCodeOwnersResponse] = serialize(
            codeowners,
            request.user,
            serializer=ProjectCodeOwnersSerializer(expand=expand),
        )
        return Response(body, status=status.HTTP_200_OK)

    @extend_schema(
        operation_id="createProjectCodeOwners",
        summary="Create a CODEOWNERS Configuration for a Project",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=ProjectCodeOwnersCreateRequestSerializer,
        responses={
            201: inline_sentry_response_serializer("ProjectCodeOwners", ProjectCodeOwnersResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=codeowners_examples.CREATE_PROJECT_CODEOWNERS,
    )
    def post(
        self, request: Request, project: Project
    ) -> Response[ProjectCodeOwnersResponse] | Response[ValidationErrorResponse]:
        """Create a CODEOWNERS configuration for a project."""
        if not self.has_feature(request, project):
            self.track_response_code("create", PermissionDenied.status_code)
            raise PermissionDenied

        serializer = ProjectCodeOwnerSerializer(context={"project": project}, data=request.data)

        if serializer.is_valid():
            project_codeowners = serializer.save()
            self.track_response_code("create", status.HTTP_201_CREATED)
            user_id = getattr(request.user, "id", None) or None
            try:
                analytics.record(
                    CodeOwnersCreated(
                        user_id=user_id,
                        organization_id=project.organization_id,
                        project_id=project.id,
                        codeowners_id=project_codeowners.id,
                    )
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)

            body: ProjectCodeOwnersResponse = serialize(
                project_codeowners,
                request.user,
                serializer=ProjectCodeOwnersSerializer(
                    expand=(*DEFAULT_CODEOWNERS_EXPAND, "ownershipSyntax")
                ),
            )
            return Response(body, status=status.HTTP_201_CREATED)

        self.track_response_code("create", status.HTTP_400_BAD_REQUEST)
        return Response(as_validation_errors(serializer), status=status.HTTP_400_BAD_REQUEST)
