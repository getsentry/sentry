from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models import projectcodeowners as projectcodeowners_serializers
from sentry.api.validators.project_codeowners import validate_codeowners_associations
from sentry.models.project import Project
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.ownership.grammar import convert_codeowners_syntax, create_schema_from_issue_owners

from . import ProjectCodeOwnerSerializer, ProjectCodeOwnersMixin


@region_silo_endpoint
class ProjectCodeOwnersEndpoint(ProjectEndpoint, ProjectCodeOwnersMixin):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    def refresh_codeowners_schema(self, codeowner: ProjectCodeOwners, project: Project) -> None:
        if hasattr(codeowner, "schema") and (
            codeowner.schema is None or codeowner.schema.get("rules") is None
        ):
            return

        if codeowner.raw is None:
            return

        # Convert raw to issue owners syntax so that the schema can be created
        raw = codeowner.raw
        associations, _ = validate_codeowners_associations(codeowner.raw, project)
        codeowner.raw = convert_codeowners_syntax(
            codeowner.raw,
            associations,
            codeowner.repository_project_path_config,
        )
        codeowner.schema = create_schema_from_issue_owners(
            project_id=project.id,
            issue_owners=codeowner.raw,
            add_owner_ids=True,
            remove_deleted_owners=True,
        )

        # Convert raw back to codeowner type to be saved
        codeowner.raw = raw

        codeowner.save()

    def get(self, request: Request, project: Project) -> Response:
        """
        Retrieve List of CODEOWNERS configurations for a project
        ````````````````````````````````````````````

        Return a list of a project's CODEOWNERS configuration.

        :auth: required
        """

        if not self.has_feature(request, project):
            raise PermissionDenied

        expand = request.GET.getlist("expand", [])
        expand.append("errors")

        codeowners = list(ProjectCodeOwners.objects.filter(project=project).order_by("-date_added"))
        for codeowner in codeowners:
            self.refresh_codeowners_schema(codeowner, project)
        expand.append("renameIdentifier")
        expand.append("hasTargetingContext")

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
        Upload a CODEOWNERS for project
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
            analytics.record(
                "codeowners.created",
                user_id=user_id,
                organization_id=project.organization_id,
                project_id=project.id,
                codeowners_id=project_codeowners.id,
            )

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
