from django.http import HttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.endpoints.release_threshold import ReleaseThresholdSerializer
from sentry.api.exceptions import ResourceDoesNotExist
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

    def put(self, request: Request, project: Project, threshold_id: str) -> HttpResponse:
        try:
            release_threshold = ReleaseThreshold.objects.get(
                id=threshold_id,
                project=project,
            )
        except ReleaseThreshold.DoesNotExist:
            raise ResourceDoesNotExist
        print("before serializer")
        serializer = ReleaseThresholdSerializer(
            release_threshold,
            data=request.data,
            context={
                "organization": project.organization,
                "access": request.access,
            },
            partial=True,
        )
        print("after serializer")
        if not serializer.is_valid():
            print("not valid")
            return Response(serializer.errors, status=400)
        print("saving")
        print("data: ", serializer.validated_data)
        serializer.save()
        return Response(serialize(release_threshold))
