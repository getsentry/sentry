from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.environment import EnvironmentField
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.models import Project
from sentry.models.release_threshold.constants import (
    THRESHOLD_TYPE_STR_TO_INT,
    TRIGGER_TYPE_STRING_TO_INT,
    ReleaseThresholdType,
    TriggerType,
)
from sentry.models.release_threshold.releasethreshold import ReleaseThreshold


class ReleaseThresholdSerializer(serializers.Serializer):
    threshold_type = serializers.ChoiceField(choices=ReleaseThresholdType.as_str_choices())
    trigger_type = serializers.ChoiceField(choices=TriggerType.as_str_choices())
    value = serializers.IntegerField()
    window_in_seconds = serializers.IntegerField()
    project = ProjectField()
    environment = EnvironmentField(required=False, allow_null=True)

    def validate_threshold_type(self, threshold_type: str):
        return THRESHOLD_TYPE_STR_TO_INT[threshold_type]

    def validate_trigger_type(self, threshold_type: str):
        return TRIGGER_TYPE_STRING_TO_INT[threshold_type]


@region_silo_endpoint
class ReleaseThresholdEndpoint(ProjectEndpoint):
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, project: Project) -> HttpResponse:
        request.data["project"] = project.slug
        serializer = ReleaseThresholdSerializer(
            data=request.data,
            context={
                "organization": project.organization,
                "access": request.access,
            },
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        result = serializer.validated_data

        release_threshold = ReleaseThreshold.objects.create(
            threshold_type=result.get("threshold_type"),
            trigger_type=result.get("trigger_type"),
            value=result.get("value"),
            window_in_seconds=result.get("window_in_seconds"),
            project=result.get("project"),
            environment=result.get("environment"),
        )
        return Response(serialize(release_threshold, request.user), status=201)
