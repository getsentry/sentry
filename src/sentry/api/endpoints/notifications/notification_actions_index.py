from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.endpoints.notifications.base import format_choices_text
from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.models.notificationaction import (
    ActionService,
    ActionTarget,
    NotificationAction,
    TriggerGenerator,
)
from sentry.models.organization import Organization
from sentry.services.hybrid_cloud.integration import integration_service


class IncomingNotificationActionSerializer(CamelSnakeModelSerializer):
    integration_id = serializers.IntegerField(required=False)
    projects = serializers.ListField(child=ProjectField(scope="project:read"))

    service_type = serializers.CharField()
    target_type = serializers.CharField()
    target_identifier = serializers.CharField()
    target_display = serializers.CharField()
    trigger_type = serializers.CharField()

    def validate_integration_id(self, integration_id: int) -> int:
        organization_integration = integration_service.get_organization_integration(
            integration_id=integration_id,
            organization_id=self.context["organization"].id,
        )
        if not organization_integration:
            raise serializers.ValidationError("Integration does not exist")
        return integration_id

    def validate_service_type(self, service_type: str) -> int:
        service_type_value = ActionService.get_value(service_type)
        if service_type_value is None:
            service_text = format_choices_text(ActionService.as_choices())
            raise serializers.ValidationError(
                f"Invalid service selected. Choose from [{service_text}]"
            )
        return service_type_value

    def validate_target_type(self, target_type: str) -> int:
        target_type_value = ActionTarget.get_value(target_type)
        if target_type_value is None:
            target_text = format_choices_text(ActionTarget.as_choices())
            raise serializers.ValidationError(
                f"Invalid target selected. Choose from [{target_text}]"
            )
        return target_type_value

    def validate_trigger_type(self, trigger_type: str) -> int:
        valid_triggers = list(TriggerGenerator())
        trigger_type_value = next(
            (value for value, text in valid_triggers if text == trigger_type), None
        )
        if trigger_type_value is None:
            trigger_text = format_choices_text(valid_triggers)
            raise serializers.ValidationError(
                f"Invalid trigger selected. Choose from [{trigger_text}]"
            )
        return trigger_type_value

    class Meta:
        model = NotificationAction
        fields = [
            "integration_id",
            "projects",
            "service_type",
            "target_type",
            "target_identifier",
            "target_display",
            "trigger_type",
        ]

    def create(self, validated_data):
        projects = validated_data.pop("projects")
        service_type = validated_data.pop("service_type")
        project_ids = [project.id for project in projects]
        action = NotificationAction(
            type=service_type,  # Using the alias service_type for clarity
            organization_id=self.context["organization"].id,
            **validated_data,
        )
        action.save()
        action.projects.add(*project_ids)
        return action


@region_silo_endpoint
class NotificationActionsIndexEndpoint(OrganizationEndpoint):
    def get(self, request, organization: Organization):
        return Response(status=200)

    def post(self, request, organization: Organization):
        serializer = IncomingNotificationActionSerializer(
            context={
                "access": request.access,
                "organization": organization,
                "user": request.user,
            },
            data=request.data,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        serializer.save()
        return Response(status=200)
