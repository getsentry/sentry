from typing import Union

from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.environment import EnvironmentField
from sentry.models.project import Project
from sentry.models.release_threshold.constants import (
    THRESHOLD_TYPE_STR_TO_INT,
    TRIGGER_TYPE_STRING_TO_INT,
    ReleaseThresholdType,
)
from sentry.models.release_threshold.constants import TriggerType as ReleaseThresholdTriggerType
from sentry.models.release_threshold.release_threshold import ReleaseThreshold


class ReleaseThresholdPOSTSerializer(serializers.Serializer):
    threshold_type = serializers.ChoiceField(choices=ReleaseThresholdType.as_str_choices())
    trigger_type = serializers.ChoiceField(choices=ReleaseThresholdTriggerType.as_str_choices())
    value = serializers.IntegerField(required=True, min_value=0)
    window_in_seconds = serializers.IntegerField(required=True, min_value=0)
    environment = EnvironmentField(required=False, allow_null=True)

    def validate_threshold_type(self, threshold_type: str):
        if threshold_type not in THRESHOLD_TYPE_STR_TO_INT:
            raise serializers.ValidationError("Invalid threshold type")
        return THRESHOLD_TYPE_STR_TO_INT[threshold_type]

    def validate_trigger_type(self, trigger_type: str):
        if trigger_type not in TRIGGER_TYPE_STRING_TO_INT:
            raise serializers.ValidationError("Invalid trigger type")
        return TRIGGER_TYPE_STRING_TO_INT[trigger_type]


@region_silo_endpoint
class ReleaseThresholdEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    def post(self, request: Request, project: Project) -> HttpResponse:
        serializer = ReleaseThresholdPOSTSerializer(
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
            project=project,
            environment=result.get("environment"),
        )
        return Response(serialize(release_threshold, request.user), status=201)

    def get(self, request: Request, project: Project) -> HttpResponse:
        release_thresholds = ReleaseThreshold.objects.filter(project=project)
        environment_name: Union[str, None] = request.GET.get("environment")

        if environment_name:
            release_thresholds = release_thresholds.filter(environment__name=environment_name)
        return Response(serialize(list(release_thresholds), request.user), status=200)
