"""Recording segment part cache manager."""
from typing import Generator

from sentry.cache import default_cache
from sentry.utils import metrics

TIMEOUT = 3600


class RecordingSegmentPart:
    def __init__(self, prefix: str) -> None:
        self.prefix = prefix

    @metrics.wraps("replays.cache.get_recording_segment")
    def __getitem__(self, index: int) -> bytes:
        result = default_cache.get(self.__key(index), raw=True)
        if result is None:
            raise ValueError(f"Missing data for chunk with id {self.__key(index)}.")
        else:
            return result

    @metrics.wraps("replays.cache.set_recording_segment")
    def __setitem__(self, index: int, value: bytes) -> None:
        return default_cache.set(self.__key(index), value, timeout=TIMEOUT, raw=True)

    @metrics.wraps("replays.cache.del_recording_segment")
    def __delitem__(self, index: int) -> None:
        default_cache.delete(self.__key(index))

    def __key(self, index: int) -> str:
        """Return an prefixed recording-segment-part key."""
        return f"{self.prefix}-{index}"


class RecordingSegmentParts:
    def __init__(self, prefix: str, num_parts: int) -> None:
        self.prefix = prefix
        self.num_parts = num_parts

    def __iter__(self) -> Generator[bytes, None, None]:
        """Iterate over each recording segment part."""
        part = RecordingSegmentPart(self.prefix)
        for i in range(self.num_parts):
            yield part[i]

    def drop(self):
        """Delete all the parts associated with the recording segment."""
        part = RecordingSegmentPart(self.prefix)
        for i in range(self.num_parts):
            del part[i]
