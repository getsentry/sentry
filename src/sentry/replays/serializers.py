from sentry.api.serializers import Serializer
from sentry.replays.models import ReplayRecordingSegment


class ReplayRecordingSegmentSerializer(Serializer):
    def serialize(self, obj: ReplayRecordingSegment, attrs, user):
        return {
            "replay_id": obj.replay_id,
            "segment_id": obj.segment_id,
            "project_id": obj.project_id,
            "date_added": obj.date_added,
        }
