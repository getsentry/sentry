from django.db import transaction
from rest_framework import serializers, status
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from sentry.api.bases import ProjectTransactionThresholdOverridePermission
from sentry.api.bases.organization_events import OrganizationEventsV2EndpointBase
from sentry.api.serializers import serialize
from sentry.models.transaction_threshold import (
    TRANSACTION_METRICS,
    ProjectTransactionThresholdOverride,
)

MAX_TRANSACTION_THRESHOLDS_PER_PROJECT = 100
MAX_VALUE = 2147483647


class ProjectTransactionThresholdOverrideSerializer(serializers.Serializer):
    transaction = serializers.CharField(required=True, max_length=200)
    threshold = serializers.IntegerField(required=True, max_value=MAX_VALUE)
    metric = serializers.CharField(required=True)

    def validate_metric(self, metric):
        for key, value in TRANSACTION_METRICS.items():
            if value == metric:
                return key

        raise serializers.ValidationError(f"Invalid transaction metric - {metric}")

    def validate_threshold(self, threshold):
        if threshold % 100:
            raise serializers.ValidationError("Invalid threshold - specify a multiple of 100")

        return threshold

    def validate(self, data):
        data = super().validate(data)
        organization = self.context.get("organization")
        project = self.context.get("project")
        count = (
            ProjectTransactionThresholdOverride.objects.filter(
                project=project, organization=organization
            )
            .exclude(transaction=data["transaction"])
            .count()
        )
        if count >= MAX_TRANSACTION_THRESHOLDS_PER_PROJECT:
            raise serializers.ValidationError(
                f"At most {MAX_TRANSACTION_THRESHOLDS_PER_PROJECT} configured transaction thresholds per project."
            )

        return data


class ProjectTransactionThresholdOverrideEndpoint(OrganizationEventsV2EndpointBase):
    permission_classes = (ProjectTransactionThresholdOverridePermission,)

    def get_project(self, request, organization):
        projects = self.get_projects(request, organization)
        if len(projects) != 1:
            raise ParseError("Only 1 project per transaction threshold")

        return projects[0]

    def get(self, request, organization):
        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        project = self.get_project(request, organization)

        try:
            project_threshold = ProjectTransactionThresholdOverride.objects.get(
                transaction=request.GET.get("transaction"),
                project_id=project.id,
                organization_id=organization.id,
            )
        except ProjectTransactionThresholdOverride.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(
            serialize(
                project_threshold,
                request.user,
            ),
            status.HTTP_200_OK,
        )

    def post(self, request, organization):
        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        project = self.get_project(request, organization)
        serializer = ProjectTransactionThresholdOverrideSerializer(
            data=request.data,
            context={
                "organization": organization,
                "project": project,
            },
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        with transaction.atomic():
            (
                transaction_threshold,
                created,
            ) = ProjectTransactionThresholdOverride.objects.update_or_create(
                transaction=data["transaction"],
                project_id=project.id,
                organization_id=organization.id,
                defaults={
                    "threshold": data["threshold"],
                    "metric": data["metric"],
                    "edited_by": request.user,
                },
            )

        return Response(
            serialize(
                transaction_threshold,
                request.user,
            ),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, organization):
        if not self.has_feature(organization, request):
            return self.respond(status=status.HTTP_404_NOT_FOUND)

        project = self.get_project(request, organization)
        transaction = request.data.get("transaction")
        if not transaction:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        try:
            transaction_threshold = ProjectTransactionThresholdOverride.objects.get(
                transaction=transaction,
                project_id=project.id,
                organization_id=organization.id,
            )
        except ProjectTransactionThresholdOverride.DoesNotExist:
            return Response(status=status.HTTP_204_NO_CONTENT)

        transaction_threshold.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)
