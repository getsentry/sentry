from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.preprod.models import PreprodArtifact


@region_silo_endpoint
class ProjectPreprodBuildDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project, artifact_id) -> Response:
        """
        Get the build details for a preprod artifact
        ````````````````````````````````````````````````````

        Get the build details for a preprod artifact.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          artifact belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to retrieve the
                                     artifact from.
        :pparam string artifact_id: the ID of the preprod artifact to get build details for.
        :auth: required
        """

        analytics.record(
            "preprod_artifact.api.get_build_details",
            organization_id=project.organization_id,
            project_id=project.id,
            user_id=request.user.id,
            artifact_id=artifact_id,
        )

        if not features.has(
            "organizations:preprod-frontend-routes", project.organization, actor=request.user
        ):
            return Response({"error": "Feature not enabled"}, status=403)

        try:
            preprod_artifact = PreprodArtifact.objects.get(
                project=project,
                id=artifact_id,
            )
        except PreprodArtifact.DoesNotExist:
            return Response({"error": f"Preprod artifact {artifact_id} not found"}, status=404)

        return Response(
            {
                "state": preprod_artifact.state,
                "app_info": {
                    "app_id": preprod_artifact.app_id,
                    "name": preprod_artifact.app_name,
                    "version": preprod_artifact.build_version,
                    "build_number": preprod_artifact.build_number,
                    "date_added": preprod_artifact.date_added,
                    "date_built": preprod_artifact.date_built,
                    "artifact_type": preprod_artifact.artifact_type,
                    "installable_app_file_id": preprod_artifact.installable_app_file_id,
                    # TODO: Implement in the future when available
                    # "build_configuration": preprod_artifact.build_configuration.name,
                    # "icon": None,
                },
                "vcs_info": {
                    "commit_id": preprod_artifact.commit.key if preprod_artifact.commit else None,
                    # TODO: Implement in the future when available
                    # "repo": None,
                    # "provider": None,
                    # "branch": None,
                },
            }
        )
