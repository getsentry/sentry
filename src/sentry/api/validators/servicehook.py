from rest_framework import serializers

from sentry.api.serializers.base import import_guard
from sentry.models import SERVICE_HOOK_EVENTS
from sentry.models.servicehook import ServiceHook


@import_guard(ServiceHook)
class ServiceHookValidator(serializers.Serializer):
    url = serializers.URLField(required=True)
    events = serializers.ListField(child=serializers.CharField(max_length=255), required=False)
    version = serializers.ChoiceField(choices=((0, "0"),), required=False, default=0)
    isActive = serializers.BooleanField(required=False, default=True)

    def validate_events(self, value):
        if value:
            for event in value:
                if event not in SERVICE_HOOK_EVENTS:
                    raise serializers.ValidationError(f"Invalid event name: {event}")
        return value
