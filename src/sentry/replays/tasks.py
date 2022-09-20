from sentry.replays.models import ReplayRecordingSegment
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.replays.tasks.delete_recording_segment",
    queue="replays",
    default_retry_delay=5,
    max_retries=5,
)
def delete_recording_segment(recording_segment_id: str, **kwargs: dict) -> None:
    """Delete a replay recording segment and its associated metadata."""
    try:
        segment = ReplayRecordingSegment.objects.get(id=recording_segment_id)
        segment.delete()  # Three queries + one request to the message broker
    except ReplayRecordingSegment.DoesNotExist:
        return None
