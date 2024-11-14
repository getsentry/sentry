from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.api.serializers import serialize
from sentry.models.transaction_threshold import (
    TRANSACTION_METRICS,
    ProjectTransactionThreshold,
    TransactionMetric,
)

DEFAULT_THRESHOLD = {
    "id": "",
    "threshold": "300",
    "metric": "duration",
}
MAX_VALUE = 2147483647


class ProjectTransactionThresholdSerializer(serializers.Serializer):
    threshold = serializers.IntegerField(required=False, max_value=MAX_VALUE)
    metric = serializers.CharField(required=False)

    def validate_metric(self, metric):
        for key, value in TRANSACTION_METRICS.items():
            if value == metric:
                return key

        raise serializers.ValidationError(f"Invalid transaction metric - {metric}")

    def validate_threshold(self, threshold):
        if threshold % 100:
            raise serializers.ValidationError("Invalid threshold - specify a multiple of 100")

        return threshold


@region_silo_endpoint
class ProjectTransactionThresholdEndpoint(ProjectEndpoint):
    owner = ApiOwner.PERFORMANCE
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectSettingPermission,)

    def has_feature(self, project, request):
        return features.has(
            "organizations:performance-view", project.organization, actor=request.user
        )

    def get(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        try:
            project_threshold = ProjectTransactionThreshold.objects.get(
                project=project,
                organization=project.organization,
            )
        except ProjectTransactionThreshold.DoesNotExist:
            return Response(
                data={"projectId": str(project.id), **DEFAULT_THRESHOLD},
                status=status.HTTP_200_OK,
            )

        return Response(
            serialize(
                project_threshold,
                request.user,
            ),
            status.HTTP_200_OK,
        )

    def post(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        serializer = ProjectTransactionThresholdSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        defaults = {"edited_by_id": request.user.id}
        if data.get("threshold") is not None:
            defaults["threshold"] = data.get("threshold")
        if data.get("metric") is not None:
            defaults["metric"] = data.get("metric")

        project_threshold, created = ProjectTransactionThreshold.objects.update_or_create(
            project=project,
            organization=project.organization,
            create_defaults={
                "threshold": data.get("threshold", 300),
                "metric": data.get("metric", TransactionMetric.DURATION.value),
                "edited_by_id": request.user.id,
            },
            defaults=defaults,
        )

        return Response(
            serialize(
                project_threshold,
                request.user,
            ),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request: Request, project) -> Response:
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        try:
            project_threshold = ProjectTransactionThreshold.objects.get(
                project=project,
                organization=project.organization,
            )
        except ProjectTransactionThreshold.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)

        project_threshold.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
