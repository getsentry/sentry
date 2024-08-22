from typing import TypedDict

from rest_framework import serializers

from sentry.api.serializers.rest_framework.base import CamelSnakeModelSerializer
from sentry.api.serializers.rest_framework.notification_action import format_choices_text
from sentry.models.notificationhistory import NotificationHistory, NotificationHistoryStatus


# Note the ordering of fields affects the Spike Protection API Documentation
class NotificationHistoryInputData(TypedDict):
    status: int


class NotificationHistorySerializer(CamelSnakeModelSerializer):
    """
    Django Rest Framework serializer for incoming NotificationHistory API payloads
    """

    status = serializers.CharField()

    def validate_status(self, incoming_status: str) -> str:
        status = NotificationHistoryStatus.get_name(incoming_status)
        if status is None:
            status_choices = format_choices_text(NotificationHistoryStatus.as_choices())
            raise serializers.ValidationError(
                f"Invalid status selected. Choose from {status_choices}."
            )
        return incoming_status

    class Meta:
        model = NotificationHistory
        fields = list(NotificationHistoryInputData.__annotations__.keys())

    def update(
        self, instance: NotificationHistory, validated_data: NotificationHistoryInputData
    ) -> NotificationHistory:
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        return instance
