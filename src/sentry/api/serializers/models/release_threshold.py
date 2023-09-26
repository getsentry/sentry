from sentry.api.serializers import Serializer, register, serialize
from sentry.models.release_threshold.constants import (
    THRESHOLD_TYPE_INT_TO_STR,
    TRIGGER_TYPE_INT_TO_STR,
)
from sentry.models.release_threshold.release_threshold import ReleaseThreshold


@register(ReleaseThreshold)
class ReleaseThresholdSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "id": str(obj.id),
            "threshold_type": THRESHOLD_TYPE_INT_TO_STR[obj.threshold_type],
            "trigger_type": TRIGGER_TYPE_INT_TO_STR[obj.trigger_type],
            "value": obj.value,
            "window_in_seconds": obj.window_in_seconds,
            "project": serialize(obj.project),
            "environment": serialize(obj.environment) if obj.environment else None,
            "date_added": obj.date_added,
        }
