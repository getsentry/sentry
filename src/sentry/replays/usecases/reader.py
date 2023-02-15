from concurrent.futures import ThreadPoolExecutor
from typing import List

from sentry.replays.lib.storage import make_storage_driver_from_id
from sentry.replays.models import ReplayRecordingSegment


def fetch_segments_data(segments: List[ReplayRecordingSegment]) -> str:
    """Format segment response as an array of segment blobs."""
    with ThreadPoolExecutor(max_workers=4) as exe:
        results = exe.map(fetch_segment_data, segments)
        return (b"[" + b",".join(results) + b"]").decode("utf-8")


def fetch_segment_data(segment: ReplayRecordingSegment) -> bytes:
    """Return recording-segment bytes from blob storage."""
    driver = make_storage_driver_from_id(segment.driver)
    return driver.get(segment)
