from __future__ import annotations

import logging
from typing import Any

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models import projectcodeowners as projectcodeowners_serializers
from sentry.models.project import Project
from sentry.models.projectcodeowners import ProjectCodeOwners

from . import ProjectCodeOwnerSerializer, ProjectCodeOwnersMixin

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectCodeOwnersDetailsEndpoint(ProjectEndpoint, ProjectCodeOwnersMixin):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }

    def convert_args(
        self,
        request: Request,
        organization_slug: str,
        project_slug: str,
        codeowners_id: str,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[Any, Any]:
        args, kwargs = super().convert_args(
            request, organization_slug, project_slug, *args, **kwargs
        )
        try:
            kwargs["codeowners"] = ProjectCodeOwners.objects.get(
                id=codeowners_id, project=kwargs["project"]
            )
        except ProjectCodeOwners.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs

    def put(self, request: Request, project: Project, codeowners: ProjectCodeOwners) -> Response:
        """
        Update a CodeOwners
        `````````````

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project to get.
        :pparam string codeowners_id: id of codeowners object
        :param string raw: the raw CODEOWNERS text
        :param string codeMappingId: id of the RepositoryProjectPathConfig object
        :auth: required
        """
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
                "codeowners.updated",
                user_id=user_id,
                organization_id=project.organization_id,
                project_id=project.id,
                codeowners_id=updated_codeowners.id,
            )
            self.track_response_code("update", status.HTTP_200_OK)
            return Response(
                serialize(
                    updated_codeowners,
                    request.user,
                    serializer=projectcodeowners_serializers.ProjectCodeOwnersSerializer(
                        expand=["ownershipSyntax", "errors"]
                    ),
                ),
                status=status.HTTP_200_OK,
            )

        self.track_response_code("update", status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request: Request, project: Project, codeowners: ProjectCodeOwners) -> Response:
        """
        Delete a CodeOwners
        """
        if not self.has_feature(request, project):
            raise PermissionDenied

        codeowners.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
