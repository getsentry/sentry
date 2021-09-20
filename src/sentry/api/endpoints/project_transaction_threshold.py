from django.db import transaction
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import features
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


class ProjectTransactionThresholdEndpoint(ProjectEndpoint):
    permission_classes = (ProjectSettingPermission,)

    def has_feature(self, project, request):
        return features.has(
            "organizations:performance-view", project.organization, actor=request.user
        )

    def get(self, request, project):
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

    def post(self, request, project):
        if not self.has_feature(project, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        serializer = ProjectTransactionThresholdSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        with transaction.atomic():
            try:
                project_threshold = ProjectTransactionThreshold.objects.get(
                    project=project,
                    organization=project.organization,
                )
                project_threshold.threshold = data.get("threshold") or project_threshold.threshold
                project_threshold.metric = data.get("metric") or project_threshold.metric
                project_threshold.edited_by = request.user
                project_threshold.save()

                created = False

            except ProjectTransactionThreshold.DoesNotExist:
                project_threshold = ProjectTransactionThreshold.objects.create(
                    project=project,
                    organization=project.organization,
                    threshold=data.get("threshold", 300),
                    metric=data.get("metric", TransactionMetric.DURATION.value),
                    edited_by=request.user,
                )

                created = True

        return Response(
            serialize(
                project_threshold,
                request.user,
            ),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, project):
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
