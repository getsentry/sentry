import logging
from typing import Any

from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.project import Project
from sentry.models.release_threshold.constants import (
    THRESHOLD_TYPE_STR_TO_INT,
    TRIGGER_TYPE_STRING_TO_INT,
    ReleaseThresholdType,
)
from sentry.models.release_threshold.constants import TriggerType as ReleaseThresholdTriggerType
from sentry.models.release_threshold.release_threshold import ReleaseThreshold

logger = logging.getLogger("sentry.release_thresholds")


class ReleaseThresholdPUTSerializer(serializers.Serializer):
    threshold_type = serializers.ChoiceField(choices=ReleaseThresholdType.as_str_choices())
    trigger_type = serializers.ChoiceField(choices=ReleaseThresholdTriggerType.as_str_choices())
    value = serializers.IntegerField(required=True, min_value=0)
    window_in_seconds = serializers.IntegerField(required=True, min_value=0)

    def validate_threshold_type(self, threshold_type: str):
        if threshold_type not in THRESHOLD_TYPE_STR_TO_INT:
            raise serializers.ValidationError("Invalid threshold type")
        return THRESHOLD_TYPE_STR_TO_INT[threshold_type]

    def validate_trigger_type(self, trigger_type: str):
        if trigger_type not in TRIGGER_TYPE_STRING_TO_INT:
            raise serializers.ValidationError("Invalid trigger type")
        return TRIGGER_TYPE_STRING_TO_INT[trigger_type]


@region_silo_endpoint
class ReleaseThresholdDetailsEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }

    def convert_args(
        self,
        request: Request,
        *args,
        **kwargs,
    ) -> Any:
        parsed_args, parsed_kwargs = super().convert_args(request, *args, **kwargs)
        try:
            parsed_kwargs["release_threshold"] = ReleaseThreshold.objects.get(
                id=kwargs["release_threshold"],
                project=parsed_kwargs["project"],
            )
        except ReleaseThreshold.DoesNotExist:
            raise ResourceDoesNotExist
        return parsed_args, parsed_kwargs

    def get(
        self, request: Request, project: Project, release_threshold: ReleaseThreshold
    ) -> HttpResponse:
        return Response(serialize(release_threshold, request.user), status=200)

    def put(
        self, request: Request, project: Project, release_threshold: ReleaseThreshold
    ) -> HttpResponse:
        serializer = ReleaseThresholdPUTSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated_data = serializer.validated_data
        release_threshold.update(**validated_data)
        return Response(serialize(release_threshold, request.user), status=200)

    def delete(
        self, request: Request, project: Project, release_threshold: ReleaseThreshold
    ) -> HttpResponse:
        release_threshold.delete()
        return Response(status=204)
