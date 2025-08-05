import logging

from pydantic import BaseModel
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.preprod.models import PreprodArtifact
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


class InstallableBuildDetails(BaseModel):
    build_version: str
    build_number: int


class CheckForUpdatesApiResponse(BaseModel):
    update: InstallableBuildDetails | None = None
    current: InstallableBuildDetails | None = None


@region_silo_endpoint
class ProjectPreprodArtifactCheckForUpdatesEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (ProjectReleasePermission,)

    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.ORGANIZATION: RateLimit(
                limit=100, window=60
            ),  # 100 requests per minute per org
        }
    }

    def get(self, request: Request, project) -> Response:
        """
        Check for updates for a preprod artifact
        """
        main_binary_identifier = request.GET.get("main_binary_identifier")
        if not main_binary_identifier:
            # Not implemented yet
            return Response(CheckForUpdatesApiResponse().dict())

        try:
            preprod_artifact = PreprodArtifact.objects.filter(
                project=project, main_binary_identifier=main_binary_identifier
            ).latest("date_added")
        except PreprodArtifact.DoesNotExist:
            return Response({"error": "Not found"}, status=404)

        if preprod_artifact.build_version and preprod_artifact.build_number:
            current = InstallableBuildDetails(
                build_version=preprod_artifact.build_version,
                build_number=preprod_artifact.build_number,
            )
        else:
            current = None
        return Response(CheckForUpdatesApiResponse(current=current).dict())
