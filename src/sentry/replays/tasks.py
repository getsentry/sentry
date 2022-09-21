from sentry.replays.models import ReplayRecordingSegment
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.replays.tasks.delete_recording_segments",
    queue="replays",
    default_retry_delay=5,
    max_retries=5,
)
def delete_recording_segments(project_id: int, replay_id: str, **kwargs: dict) -> None:
    """Delete a replay's recording segments and its associated metadata."""
    segments = ReplayRecordingSegment.objects.filter(
        replay_id=replay_id, project_id=project_id
    ).all()
    for segment in segments:
        segment.delete()  # Three queries + one request to the message broker
