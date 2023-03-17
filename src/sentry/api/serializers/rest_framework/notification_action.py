from typing import Dict, List, Tuple, TypedDict

from django.db import transaction
from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.serializers.rest_framework.project import ProjectField
from sentry.models.notificationaction import ActionService, ActionTarget, NotificationAction
from sentry.models.project import Project
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.utils.strings import oxfordize_list


def format_choices_text(choices: List[Tuple[int, str]]):
    choices_as_display_text = [f"'{display_text}'" for (_, display_text) in choices]
    return oxfordize_list(choices_as_display_text)


class NotificationActionInputData(TypedDict):
    integration_id: int
    projects: List[Project]
    service_type: int
    trigger_type: int
    target_type: int
    target_identifier: str
    target_display: str


class NotificationActionSerializer(CamelSnakeModelSerializer):
    """
    Django Rest Framework serializer for incoming NotificationAction API payloads
    """

    integration_id = serializers.IntegerField(required=False)
    projects = serializers.ListField(child=ProjectField(scope="project:read"), required=False)

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
                f"Invalid service selected. Choose from {service_text}."
            )
        return service_type_value

    def validate_target_type(self, target_type: str) -> int:
        target_type_value = ActionTarget.get_value(target_type)
        if target_type_value is None:
            target_text = format_choices_text(ActionTarget.as_choices())
            raise serializers.ValidationError(
                f"Invalid target selected. Choose from {target_text}."
            )
        return target_type_value

    def validate_trigger_type(self, trigger_type: str) -> int:
        valid_triggers: Dict[str, int] = {v: k for k, v in NotificationAction.get_trigger_types()}
        trigger_type_value = valid_triggers.get(trigger_type)
        if trigger_type_value is None:
            trigger_text = format_choices_text(NotificationAction.get_trigger_types())
            raise serializers.ValidationError(
                f"Invalid trigger selected. Choose from {trigger_text}."
            )
        return trigger_type_value

    class Meta:
        model = NotificationAction
        fields = list(NotificationActionInputData.__annotations__.keys())

    def create(self, validated_data: NotificationActionInputData) -> NotificationAction:
        projects = validated_data.pop("projects", [])
        service_type = validated_data.pop("service_type")
        action = NotificationAction(
            type=service_type,
            organization_id=self.context["organization"].id,
            **validated_data,
        )
        with transaction.atomic():
            action.save()
            action.projects.set(projects)
        return action

    def update(
        self, instance: NotificationAction, validated_data: NotificationActionInputData
    ) -> NotificationAction:
        projects = validated_data.pop("projects", [])
        service_type = validated_data.pop("service_type")
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.type = service_type
        with transaction.atomic():
            instance.save()
            instance.projects.set(projects)
        return instance
