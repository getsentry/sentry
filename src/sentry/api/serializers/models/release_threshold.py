from sentry.api.serializers import Serializer, register, serialize
from sentry.models.releasethreshold import ReleaseThreshold, ReleaseThresholdType, TriggerType


@register(ReleaseThreshold)
class ReleaseThresholdSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "threshold_type": ReleaseThresholdType.INT_TO_STRING[obj.threshold_type],
            "trigger_type": TriggerType.INT_TO_STRING[obj.trigger_type],
            "value": obj.value,
            "window_in_seconds": obj.window_in_seconds,
            "project": serialize(obj.project),
            "environment": serialize(obj.environment) if obj.environment else None,
            "date_added": obj.date_added,
        }
