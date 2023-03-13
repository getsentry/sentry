from typing import List, Tuple

from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.models.notificationaction import (
    ActionService,
    ActionTarget,
    NotificationAction,
    TriggerGenerator,
)
from sentry.services.hybrid_cloud.integration import integration_service


def format_choices_text(choices: List[Tuple[int, str]]):
    return ", ".join([f"'{display_text}'" for (_, display_text) in choices])


class NotificationActionSerializer(CamelSnakeModelSerializer):
    """
    Django Rest Framework serializer for incoming NotificationAction payloads to the API.
    """

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
        action = NotificationAction(
            type=service_type,
            organization_id=self.context["organization"].id,
            **validated_data,
        )
        action.save()
        action.projects.set(projects)
        return action

    def update(self, instance: NotificationAction, validated_data):
        projects = validated_data.pop("projects")
        service_type = validated_data.pop("service_type")
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.type = service_type
        instance.save()
        instance.projects.set(projects)
        return instance
