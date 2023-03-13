from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.endpoints.notifications.base import BaseNotificationActionsEndpoint
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.services.hybrid_cloud.integration import integration_service


class NotificationActionSerializer(serializers.Serializer):
    project_id = serializers.IntegerField()
    integration_id = serializers.IntegerField()
    # trigger_type = serializers.IntegerField(
    #     min_value=0,
    #     max_value=len(BillingTriggerType) - 1,
    # )
    # target_type = serializers.IntegerField(
    #     min_value=0,
    #     max_value=len(BillingTriggerTargetType) - 1,
    # )
    target_display = serializers.CharField()
    target_config = serializers.JSONField(required=False)

    def validate_project_id(self, project_id: int) -> int:
        project_query = Project.objects.filter(id=project_id, organization_id=self.organization.id)
        if not project_query.exists():
            raise serializers.ValidationError("Project does not exist")
        return project_id

    def validate_integration_id(self, integration_id: int) -> int:
        organization_integration = integration_service.get_organization_integration(
            integration_id=integration_id,
            organization_id=self.organization.id,
        )
        if not organization_integration:
            raise serializers.ValidationError("Integration does not exist")
        return integration_id


@region_silo_endpoint
class NotificationActionsIndexEndpoint(BaseNotificationActionsEndpoint):
    def get(self, request, organization: Organization):
        return Response(status=200)

    def post(self, request, organization: Organization):
        return Response(status=200)
