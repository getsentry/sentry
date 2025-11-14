from typing import int
import sentry_sdk
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.analytics.events.codeowners_created import CodeOwnersCreated
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models import projectcodeowners as projectcodeowners_serializers
from sentry.issues.endpoints.bases.codeowners import ProjectCodeOwnersBase
from sentry.issues.endpoints.serializers import ProjectCodeOwnerSerializer
from sentry.models.project import Project
from sentry.models.projectcodeowners import ProjectCodeOwners


@region_silo_endpoint
class ProjectCodeOwnersEndpoint(ProjectCodeOwnersBase):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project) -> Response:
        """
        Retrieve the list of CODEOWNERS configurations for a project
        ````````````````````````````````````````````

        Return a list of a project's CODEOWNERS configuration.

        :auth: required
        """

        if not self.has_feature(request, project):
            raise PermissionDenied

        expand = request.GET.getlist("expand", [])
        expand.extend(["errors", "renameIdentifier", "hasTargetingContext"])

        codeowners: list[ProjectCodeOwners] = list(
            ProjectCodeOwners.objects.filter(project=project).order_by("-date_added")
        )

        return Response(
            serialize(
                codeowners,
                request.user,
                serializer=projectcodeowners_serializers.ProjectCodeOwnersSerializer(expand=expand),
            ),
            status.HTTP_200_OK,
        )

    def post(self, request: Request, project: Project) -> Response:
        """
        Upload a CODEOWNERS for a project
        `````````````

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :pparam string project_id_or_slug: the id or slug of the project to get.
        :param string raw: the raw CODEOWNERS text
        :param string codeMappingId: id of the RepositoryProjectPathConfig object
        :auth: required
        """
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

            expand = ["ownershipSyntax", "errors", "hasTargetingContext"]

            return Response(
                serialize(
                    project_codeowners,
                    request.user,
                    serializer=projectcodeowners_serializers.ProjectCodeOwnersSerializer(
                        expand=expand
                    ),
                ),
                status=status.HTTP_201_CREATED,
            )

        self.track_response_code("create", status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
