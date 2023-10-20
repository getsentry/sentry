from typing import Any

from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
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


class ReleaseThresholdPUTSerializer(serializers.Serializer):
    threshold_type = serializers.ChoiceField(choices=ReleaseThresholdType.as_str_choices())
    trigger_type = serializers.ChoiceField(choices=ReleaseThresholdTriggerType.as_str_choices())
    value = serializers.IntegerField()
    window_in_seconds = serializers.IntegerField()

    def validate_threshold_type(self, threshold_type: str):
        return THRESHOLD_TYPE_STR_TO_INT[threshold_type]

    def validate_trigger_type(self, threshold_type: str):
        return TRIGGER_TYPE_STRING_TO_INT[threshold_type]


@region_silo_endpoint
class ReleaseThresholdDetailsEndpoint(ProjectEndpoint):
    owner: ApiOwner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
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

        if serializer.is_valid():
            result = serializer.validated_data
            kwargs = {}
            if "threshold_type" in result:
                kwargs["threshold_type"] = result["threshold_type"]
            if "trigger_type" in result:
                kwargs["trigger_type"] = result["trigger_type"]
            if "value" in result:
                kwargs["value"] = result["value"]
            if "window_in_seconds" in result:
                kwargs["window_in_seconds"] = result["window_in_seconds"]

            if kwargs:
                release_threshold.update(**kwargs)
            return Response(serialize(release_threshold, request.user), status=200)
        return Response(serializer.errors, status=400)
