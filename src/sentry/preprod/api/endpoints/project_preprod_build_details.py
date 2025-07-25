import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.preprod.analytics import PreprodArtifactApiGetBuildDetailsEvent
from sentry.preprod.api.models.project_preprod_build_details_models import (
    BuildDetailsApiResponse,
    BuildDetailsAppInfo,
    BuildDetailsSizeInfo,
    BuildDetailsVcsInfo,
    platform_from_artifact_type,
)
from sentry.preprod.build_distribution_utils import is_installable_artifact
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics

logger = logging.getLogger(__name__)


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
            PreprodArtifactApiGetBuildDetailsEvent(
                organization_id=project.organization_id,
                project_id=project.id,
                user_id=request.user.id,
                artifact_id=artifact_id,
            )
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

        try:
            size_metrics_qs = PreprodArtifactSizeMetrics.objects.select_related(
                "preprod_artifact"
            ).filter(
                preprod_artifact__project=project,
                preprod_artifact__id=artifact_id,
            )
            size_metrics_count = size_metrics_qs.count()
            if size_metrics_count == 0:
                logger.info("No size analysis results found for preprod artifact %s", artifact_id)
                size_info = None
            elif size_metrics_count > 1:
                logger.info(
                    "Multiple size analysis results found for preprod artifact %s", artifact_id
                )
                size_info = None
            else:
                size_metrics = size_metrics_qs.first()
                logger.info(
                    "Size analysis results found for preprod artifact %s: %s, %s, %s, %s",
                    artifact_id,
                    size_metrics.min_install_size,
                    size_metrics.min_download_size,
                    size_metrics.max_install_size,
                    size_metrics.max_download_size,
                )
                if size_metrics.min_install_size is None or size_metrics.min_download_size is None:
                    logger.info(
                        "Size analysis results found for preprod artifact %s but no min install or download size",
                        artifact_id,
                    )
                    size_info = None
                else:
                    size_info = BuildDetailsSizeInfo(
                        install_size_bytes=size_metrics.min_install_size,
                        download_size_bytes=size_metrics.min_download_size,
                    )
        except Exception:
            return Response(
                {"error": "Failed to retrieve size analysis results"},
                status=500,
            )

        app_info = BuildDetailsAppInfo(
            app_id=preprod_artifact.app_id,
            name=preprod_artifact.app_name,
            version=preprod_artifact.build_version,
            build_number=preprod_artifact.build_number,
            date_added=(
                preprod_artifact.date_added.isoformat() if preprod_artifact.date_added else None
            ),
            date_built=(
                preprod_artifact.date_built.isoformat() if preprod_artifact.date_built else None
            ),
            artifact_type=preprod_artifact.artifact_type,
            platform=platform_from_artifact_type(preprod_artifact.artifact_type),
            is_installable=is_installable_artifact(preprod_artifact),
            # TODO: Implement in the future when available
            # build_configuration=preprod_artifact.build_configuration.name if preprod_artifact.build_configuration else None,
            # icon=None,
        )

        vcs_info = BuildDetailsVcsInfo(
            commit_id=preprod_artifact.commit.key if preprod_artifact.commit else None,
            # TODO: Implement in the future when available
            # repo=None,
            # provider=None,
            # branch=None,
        )

        api_response = BuildDetailsApiResponse(
            state=preprod_artifact.state,
            app_info=app_info,
            vcs_info=vcs_info,
            size_info=size_info,
        )

        return Response(api_response.dict())
