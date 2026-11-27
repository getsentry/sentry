import threading
import zlib
from collections.abc import Generator
from unittest import mock

import pytest

from sentry.replays.lib.storage import RecordingSegmentStorageMeta
from sentry.replays.usecases import reader
from sentry.replays.usecases.pack import pack
from sentry.testutils.helpers.options import override_options


@pytest.fixture(autouse=True)
def max_size() -> Generator[None]:
    with override_options({"replay.consumer.max-segment-decompressed-size": 1024}):
        yield


def _meta(segment_id: int) -> RecordingSegmentStorageMeta:
    return RecordingSegmentStorageMeta(
        project_id=1, replay_id="a" * 32, segment_id=segment_id, retention_days=30, file_id=None
    )


def test_decompress_within_limit() -> None:
    assert reader.decompress(zlib.compress(b"x" * 1024)) == b"x" * 1024


@pytest.mark.parametrize(
    "buffer",
    [
        pytest.param(zlib.compress(b"\x00" * (64 * 1024 * 1024)), id="over_limit"),
        pytest.param(zlib.compress(b"x" * 1024)[:10], id="truncated"),
        pytest.param(b"\x78\x9cnot-zlib", id="invalid"),
    ],
)
def test_decompress_rejected(buffer: bytes) -> None:
    assert reader.decompress(buffer) is None


def test_download_oversized_segment_is_empty() -> None:
    blob = zlib.compress(pack(b"x" * 2048, None))
    with mock.patch("sentry.replays.usecases.reader.storage.get", return_value=blob):
        assert reader.download_segment(_meta(0), span=None) == b"[]"
        assert reader.download_video(_meta(0)) is None


def test_iter_segment_data_is_ordered_and_windowed() -> None:
    segments = [_meta(i) for i in range(reader.SEGMENT_DOWNLOAD_WINDOW * 3)]
    lock = threading.Lock()
    started = consumed = max_ahead = 0

    def fake_download(
        segment: RecordingSegmentStorageMeta,
    ) -> tuple[memoryview | None, memoryview] | None:
        nonlocal started, max_ahead
        with lock:
            started += 1
            max_ahead = max(max_ahead, started - consumed)
        if segment.segment_id == 3:
            return None
        return None, memoryview(str(segment.segment_id).encode())

    results = []
    with mock.patch.object(reader, "_download_segment", side_effect=fake_download):
        for i, data in reader.iter_segment_data(segments):
            results.append((i, bytes(data)))
            with lock:
                consumed += 1

    assert results == [(i, b"[]" if i == 3 else str(i).encode()) for i in range(len(segments))]
    assert max_ahead <= reader.SEGMENT_DOWNLOAD_WINDOW
