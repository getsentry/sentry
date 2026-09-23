from __future__ import annotations

import logging
from typing import Any

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.analytics.events.codeowners_updated import CodeOwnersUpdated
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.projectcodeowners import (
    DEFAULT_CODEOWNERS_EXPAND,
    ProjectCodeOwnersResponse,
    ProjectCodeOwnersSerializer,
)
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples import codeowners_examples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import ValidationErrorResponse, as_validation_errors
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.issues.endpoints.bases.codeowners import ProjectCodeOwnersBase
from sentry.issues.endpoints.serializers import (
    ProjectCodeOwnerSerializer,
    ProjectCodeOwnersUpdateRequestSerializer,
)
from sentry.models.project import Project
from sentry.models.projectcodeowners import ProjectCodeOwners

logger = logging.getLogger(__name__)

CODEOWNERS_ID_PARAM = OpenApiParameter(
    name="codeowners_id",
    location=OpenApiParameter.PATH,
    required=True,
    type=str,
    description="The ID of the CODEOWNERS configuration.",
)


@cell_silo_endpoint
@extend_schema(tags=["Projects"])
class ProjectCodeOwnersDetailsEndpoint(ProjectCodeOwnersBase):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: int | str,
        project_id_or_slug: int | str,
        codeowners_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[Any, Any]:
        args, kwargs = super().convert_args(
            request, organization_id_or_slug, project_id_or_slug, *args, **kwargs
        )
        try:
            kwargs["codeowners"] = ProjectCodeOwners.objects.get(
                id=codeowners_id, project=kwargs["project"]
            )
        except ProjectCodeOwners.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs

    @extend_schema(
        operation_id="retrieveProjectCodeOwners",
        summary="Retrieve a Project's CODEOWNERS Configuration",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            CODEOWNERS_ID_PARAM,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer("ProjectCodeOwners", ProjectCodeOwnersResponse),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=codeowners_examples.RETRIEVE_PROJECT_CODEOWNERS,
    )
    def get(
        self, request: Request, project: Project, codeowners: ProjectCodeOwners
    ) -> Response[ProjectCodeOwnersResponse]:
        """Return a single CODEOWNERS configuration."""
        if not self.has_feature(request, project):
            raise PermissionDenied

        body: ProjectCodeOwnersResponse = serialize(
            codeowners,
            request.user,
            serializer=ProjectCodeOwnersSerializer(expand=DEFAULT_CODEOWNERS_EXPAND),
        )
        return Response(body, status=status.HTTP_200_OK)

    @extend_schema(
        operation_id="updateProjectCodeOwners",
        summary="Update a Project's CODEOWNERS Configuration",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            CODEOWNERS_ID_PARAM,
        ],
        request=ProjectCodeOwnersUpdateRequestSerializer,
        responses={
            200: inline_sentry_response_serializer("ProjectCodeOwners", ProjectCodeOwnersResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=codeowners_examples.UPDATE_PROJECT_CODEOWNERS,
    )
    def put(
        self, request: Request, project: Project, codeowners: ProjectCodeOwners
    ) -> Response[ProjectCodeOwnersResponse] | Response[ValidationErrorResponse]:
        """Update a CODEOWNERS configuration."""
        if not self.has_feature(request, project):
            self.track_response_code("update", PermissionDenied.status_code)
            raise PermissionDenied

        serializer = ProjectCodeOwnerSerializer(
            instance=codeowners,
            context={"project": project},
            partial=True,
            data={**request.data},
        )
        if serializer.is_valid():
            updated_codeowners = serializer.save()

            user_id = getattr(request.user, "id", None) or None
            analytics.record(
                CodeOwnersUpdated(
                    user_id=user_id,
                    organization_id=project.organization_id,
                    project_id=project.id,
                    codeowners_id=updated_codeowners.id,
                )
            )
            self.track_response_code("update", status.HTTP_200_OK)
            body: ProjectCodeOwnersResponse = serialize(
                updated_codeowners,
                request.user,
                serializer=ProjectCodeOwnersSerializer(
                    expand=(*DEFAULT_CODEOWNERS_EXPAND, "ownershipSyntax")
                ),
            )
            return Response(body, status=status.HTTP_200_OK)

        self.track_response_code("update", status.HTTP_400_BAD_REQUEST)
        return Response(as_validation_errors(serializer), status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        operation_id="deleteProjectCodeOwners",
        summary="Delete a Project's CODEOWNERS Configuration",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            CODEOWNERS_ID_PARAM,
        ],
        request=None,
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self, request: Request, project: Project, codeowners: ProjectCodeOwners
    ) -> Response[None]:
        """Delete a CODEOWNERS configuration."""
        if not self.has_feature(request, project):
            raise PermissionDenied

        codeowners.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
