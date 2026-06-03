from rest_framework import serializers

from sentry.sentry_apps.models.servicehook import SERVICE_HOOK_EVENTS


class ServiceHookValidator(serializers.Serializer):
    url = serializers.URLField(required=True, help_text="The URL that events will be sent to.")
    events = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        help_text="The list of events to subscribe to, e.g. `event.alert`, `event.created`.",
    )
    version = serializers.ChoiceField(
        choices=((0, "0"),),
        required=False,
        default=0,
        help_text="The version of the service hook payload format.",
    )
    isActive = serializers.BooleanField(
        required=False, default=True, help_text="Whether the service hook is active."
    )

    def validate_events(self, value):
        if value:
            for event in value:
                if event not in SERVICE_HOOK_EVENTS:
                    raise serializers.ValidationError(f"Invalid event name: {event}")
        return value
