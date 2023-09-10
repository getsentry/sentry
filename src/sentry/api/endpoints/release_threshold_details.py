from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.models import Project
from sentry.models.release_threshold.releasethreshold import ReleaseThreshold


class ReleaseThresholdDetailsGETSerializer(serializers.Serializer):
    threshold_id = serializers.CharField()
    project = ProjectField()


@region_silo_endpoint
class ReleaseThresholdDetailsEndpoint(ProjectEndpoint):
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project, threshold_id: str) -> HttpResponse:
        request.data["project"] = project.slug
        request.data["threshold_id"] = threshold_id
        serializer = ReleaseThresholdDetailsGETSerializer(
            data=request.data,
            context={
                "organization": project.organization,
                "access": request.access,
            },
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        result = serializer.validated_data
        try:
            release_threshold = ReleaseThreshold.objects.get(
                id=result.get("threshold_id"),
                project=project,
            )
            return Response(serialize(release_threshold, request.user), status=200)
        except ReleaseThreshold.DoesNotExist:
            return Response(status=404)
