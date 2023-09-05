from sentry.api.serializers import Serializer, register, serialize
from sentry.models import ReleaseThreshold


@register(ReleaseThreshold)
class ReleaseThresholdSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "threshold_type": obj.threshold_type,
            "trigger_type": obj.trigger_type,
            "value": obj.value,
            "window_in_seconds": obj.window_in_seconds,
            "project": serialize(obj.project),
            "environment": serialize(obj.environment) if obj.environment else None,
            "date_added": obj.date_added,
        }
