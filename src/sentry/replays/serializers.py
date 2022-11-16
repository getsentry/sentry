from rest_framework import serializers

from sentry.api.serializers import Serializer
from sentry.replays.models import ReplayRecordingSegment


class ReplayRecordingSegmentSerializer(Serializer):
    def serialize(self, obj: ReplayRecordingSegment, attrs, user):
        return {
            "replayId": obj.replay_id,
            "segmentId": obj.segment_id,
            "projectId": str(obj.project_id),
            "dateAdded": obj.date_added,
        }


VALID_FIELD_SET = {
    "id",
    "title",
    "projectId",
    "errorIds",
    "traceIds",
    "urls",
    "startedAt",
    "finishedAt",
    "duration",
    "countErrors",
    "countSegments",
    "countUrls",
    "longestTransaction",
    "platform",
    "environment",
    "release",
    "dist",
    "user",
    "os",
    "browser",
    "device",
    "sdk",
    "tags",
    "activity",
}


class ReplaySerializer(serializers.Serializer):
    statsPeriod = serializers.CharField(
        help_text=(
            "This defines the range of the time series, relative to now. "
            "The range is given in a `<number><unit>` format. "
            "For example `1d` for a one day range. Possible units are `m` for minutes, `h` for hours, `d` for days and `w` for weeks."
            "You must either provide a `statsPeriod`, or a `start` and `end`."
        ),
        required=False,
    )
    start = serializers.DateTimeField(
        help_text="This defines the start of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds."
        "Use along with `end` instead of `statsPeriod`.",
        required=False,
    )
    end = serializers.DateTimeField(
        help_text=(
            "This defines the inclusive end of the time series range as an explicit datetime, either in UTC ISO8601 or epoch seconds."
            "Use along with `start` instead of `statsPeriod`."
        ),
        required=False,
    )
    field = serializers.ChoiceField(
        VALID_FIELD_SET,
        help_text="Specifies a field that should be marshaled in the output. Invalid fields will be rejected.",
        required=False,
    )
    project = serializers.ListField(
        required=False, help_text="The ID of the projects to filter by."
    )
    environment = serializers.CharField(help_text="The environment to filter by.", required=False)
    sort = serializers.CharField(help_text="The field to sort the output by.", required=False)
    query = serializers.CharField(
        help_text="A structured query string to filter the output by.", required=False
    )
