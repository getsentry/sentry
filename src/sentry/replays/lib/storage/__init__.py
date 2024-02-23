from .blob import storage_kv
from .legacy import filestore, make_recording_filename, storage


def make_video_filename(
    retention_days: int | None,
    project_id: int,
    replay_id: str,
    segment_id: int,
) -> str:
    """Return a recording segment video filename."""
    filename = make_recording_filename(retention_days, project_id, replay_id, segment_id)
    return filename + ".video"


__all__ = (
    "storage_kv",
    "filestore",
    "storage",
    "make_recording_filename" "make_video_filename",
)
