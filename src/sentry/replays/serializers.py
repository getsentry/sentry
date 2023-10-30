from sentry.api.serializers import Serializer


class ReplayRecordingSegmentSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            "replayId": obj.replay_id,
            "segmentId": obj.segment_id,
            "projectId": str(obj.project_id),
            "dateAdded": obj.date_added,
        }
