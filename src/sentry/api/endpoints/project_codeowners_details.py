import logging

from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry import analytics
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.endpoints.project_ownership import ProjectOwnershipMixin
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models import projectcodeowners as projectcodeowners_serializers
from sentry.models import ProjectCodeOwners

from .project_codeowners import ProjectCodeOwnerSerializer, ProjectCodeOwnersMixin

logger = logging.getLogger(__name__)


class ProjectCodeOwnersDetailsEndpoint(
    ProjectEndpoint, ProjectOwnershipMixin, ProjectCodeOwnersMixin
):
    def convert_args(
        self, request, organization_slug, project_slug, codeowners_id, *args, **kwargs
    ):
        args, kwargs = super().convert_args(
            request, organization_slug, project_slug, *args, **kwargs
        )
        try:
            kwargs["codeowners"] = ProjectCodeOwners.objects.get(
                id=codeowners_id, project=kwargs["project"]
            )
        except ProjectCodeOwners.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def put(self, request, project, codeowners):
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
            context={"ownership": self.get_ownership(project), "project": project},
            partial=True,
            data={**request.data},
        )
        if serializer.is_valid():
            updated_codeowners = serializer.save()

            analytics.record(
                "codeowners.updated",
                user_id=request.user.id if request.user and request.user.id else None,
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

    def delete(self, request, project, codeowners):
        """
        Delete a CodeOwners
        """
        if not self.has_feature(request, project):
            raise PermissionDenied

        codeowners.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
