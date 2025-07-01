from drf_spectacular.utils import extend_schema_serializer
from rest_framework import serializers

from sentry.api.serializers import Serializer, register
from sentry.status_pages.models.status_update import StatusUpdate


@extend_schema_serializer(
    component_name="StatusUpdateSerializer",
    examples=[
        {
            "title": "Service Degradation",
            "description": "We are experiencing increased latency across our services",
            "type": "degraded",
            "start_time": "2024-01-15T10:00:00Z",
            "end_time": "2024-01-15T12:00:00Z",
            "should_notify_subscribers_now": None,
            "should_notify_subscribers_at_end": False,
            "should_notify_subscribers_24h_before": False,
        }
    ],
)
class StatusUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=255, required=True, help_text="The title of the status update"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="A description of the status update",
    )
    type = serializers.ChoiceField(
        choices=StatusUpdate.STATUS_TYPE_CHOICES,
        required=True,
        help_text="The type of status update",
    )
    start_time = serializers.DateTimeField(
        required=False,
        help_text="When the status update starts (defaults to now)",
    )
    end_time = serializers.DateTimeField(
        required=False,
        allow_null=True,
        help_text="When the status update ends (optional)",
    )
    parent_update = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="ID of the parent status update for updates to the same incident",
    )
    should_notify_subscribers_now = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Whether to notify subscribers immediately",
    )
    should_notify_subscribers_at_end = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Whether to notify subscribers when the status update ends",
    )
    should_notify_subscribers_24h_before = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Whether to notify subscribers 24 hours before the status update ends",
    )

    def update(self, instance, validated_data):
        """Update the status update instance with validated data."""
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


@extend_schema_serializer(component_name="StatusUpdateResponseSerializer")
@register(StatusUpdate)
class StatusUpdateResponseSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "id": str(obj.id),
            "title": obj.title,
            "description": obj.description,
            "type": obj.type,
            "startTime": obj.start_time,
            "endTime": obj.end_time,
            "statusPageId": str(obj.status_page_id),
            "parentUpdateId": str(obj.parent_update_id) if obj.parent_update_id else None,
            "shouldNotifySubscribersNow": obj.should_notify_subscribers_now,
            "shouldNotifySubscribersAtEnd": obj.should_notify_subscribers_at_end,
            "shouldNotifySubscribers24hBefore": obj.should_notify_subscribers_24h_before,
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
