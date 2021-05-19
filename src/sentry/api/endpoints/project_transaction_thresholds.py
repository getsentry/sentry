import math

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models import transaction_threshold
from sentry.models.transaction_threshold import TRANSACTION_METRICS, ProjectTransactionThreshold


class ProjectTransactionThresholdSerializer(serializers.Serializer):
    threshold = serializers.IntegerField()
    metric = serializers.CharField()

    def validate_metric(self, metric):
        for key, value in TRANSACTION_METRICS.items():
            if value == metric:
                return key

        raise serializers.ValidationError(f"Invalid transaction metric - {metric}")

    def validate_threshold(self, threshold):
        return int(math.ceil(threshold / 100)) * 100


class ProjectTransactionThresholdEndpoint(ProjectEndpoint):
    permission_classes = (ProjectSettingPermission,)

    def has_feature(self, project, request):
        return features.has(
            "organizations:project-transaction-threshold", project.organization, actor=request.user
        )

    def get(self, request, project):
        if not self.has_feature(project, request):
            return self.respond(status=404)

        try:
            project_threshold = ProjectTransactionThreshold.objects.get(project=project)
        except ProjectTransactionThreshold.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(
            serialize(
                project_threshold,
                request.user,
                serializer=transaction_threshold.ProjectTransactionThresholdSerializer(),
            ),
            status.HTTP_200_OK,
        )

    def post(self, request, project):
        if not self.has_feature(project, request):
            return self.respond(status=404)

        serializer = ProjectTransactionThresholdSerializer(data={**request.data})

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        with transaction.atomic():
            project_threshold, _ = ProjectTransactionThreshold.objects.update_or_create(
                project=project,
                organization=project.organization,
                defaults={
                    "threshold": data["threshold"],
                    "metric": data["metric"],
                    "edited_by": request.user if request.user.is_authenticated() else None,
                },
            )

        return Response(
            serialize(
                project_threshold,
                request.user,
                serializer=transaction_threshold.ProjectTransactionThresholdSerializer(),
            ),
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, project):
        if not self.has_feature(project, request):
            return self.respond(status=404)

        try:
            project_threshold = ProjectTransactionThreshold.objects.get(
                project=project,
                organization=project.organization,
            )
        except ProjectTransactionThreshold.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)

        project_threshold.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
