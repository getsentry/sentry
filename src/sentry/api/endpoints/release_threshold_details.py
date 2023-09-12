from django.http import HttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.models import Project
from sentry.models.release_threshold.releasethreshold import ReleaseThreshold


@region_silo_endpoint
class ReleaseThresholdDetailsEndpoint(ProjectEndpoint):
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project, threshold_id: str) -> HttpResponse:
        try:
            release_threshold = ReleaseThreshold.objects.get(
                id=threshold_id,
                project=project,
            )
            return Response(serialize(release_threshold, request.user), status=200)
        except ReleaseThreshold.DoesNotExist:
            return Response(status=404)
