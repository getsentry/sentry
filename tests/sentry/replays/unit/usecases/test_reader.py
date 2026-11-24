import threading
import time
import zlib
from collections.abc import Generator
from typing import Any
from unittest import mock

import pytest

from sentry.replays.lib.storage import RecordingSegmentStorageMeta
from sentry.replays.usecases import reader
from sentry.replays.usecases.pack import pack
from sentry.testutils.helpers.options import override_options

MAX_SIZE_OPTION = "replay.consumer.max-segment-decompressed-size"


@pytest.fixture(autouse=True)
def default_max_size() -> Generator[None]:
    with override_options({MAX_SIZE_OPTION: 100 * 1024 * 1024}):
        yield


def _meta(segment_id: int) -> RecordingSegmentStorageMeta:
    return RecordingSegmentStorageMeta(
        project_id=1,
        replay_id="a" * 32,
        segment_id=segment_id,
        retention_days=30,
        file_id=None,
    )


def test_decompress_uncompressed_passthrough() -> None:
    assert reader.decompress(b"[{}]") == b"[{}]"


def test_decompress_within_limit() -> None:
    data = b"x" * 1024
    with override_options({MAX_SIZE_OPTION: 1024}):
        assert reader.decompress(zlib.compress(data)) == data


def test_decompress_gzip_within_limit() -> None:
    data = b"[" + b"0," * 100 + b"0]"
    compressor = zlib.compressobj(wbits=zlib.MAX_WBITS | 16)
    gzipped = compressor.compress(data) + compressor.flush()
    assert reader.decompress(gzipped) == data


def test_decompress_over_limit_returns_none() -> None:
    with override_options({MAX_SIZE_OPTION: 1024}):
        assert reader.decompress(zlib.compress(b"x" * 1025)) is None


def test_decompress_high_ratio_is_bounded() -> None:
    """A high-ratio segment is never inflated past the limit (+1 byte to detect overflow)."""
    payload = zlib.compress(b"\x00" * (64 * 1024 * 1024), 9)
    real_decompressobj = zlib.decompressobj
    output_sizes: list[int] = []

    class RecordingDecompressor:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            self._d = real_decompressobj(*args, **kwargs)

        def decompress(self, data: bytes, max_length: int = 0) -> bytes:
            out = self._d.decompress(data, max_length)
            output_sizes.append(len(out))
            return out

        def __getattr__(self, name: str) -> Any:
            return getattr(self._d, name)

    with (
        override_options({MAX_SIZE_OPTION: 1024}),
        mock.patch("zlib.decompressobj", RecordingDecompressor),
    ):
        assert reader.decompress(payload) is None

    assert output_sizes == [1025]


def test_decompress_truncated_returns_none() -> None:
    compressed = zlib.compress(b"x" * 4096)
    assert reader.decompress(compressed[: len(compressed) // 2]) is None


def test_decompress_invalid_returns_none() -> None:
    assert reader.decompress(b"\x78\x9cnot-a-zlib-stream") is None


def test_download_segment_oversized_returns_empty_list() -> None:
    blob = zlib.compress(pack(b"x" * 2048, None))
    with (
        override_options({MAX_SIZE_OPTION: 1024}),
        mock.patch("sentry.replays.usecases.reader.storage.get", return_value=blob),
    ):
        assert reader.download_segment(_meta(0), span=None) == b"[]"
        assert reader.download_video(_meta(0)) is None


def test_iter_segment_data_preserves_order_and_missing() -> None:
    segments = [_meta(i) for i in range(10)]

    def fake_download(
        segment: RecordingSegmentStorageMeta,
    ) -> tuple[memoryview | None, memoryview] | None:
        if segment.segment_id == 3:
            return None
        return None, memoryview(str(segment.segment_id).encode())

    with mock.patch.object(reader, "_download_segment", side_effect=fake_download):
        results = [(i, bytes(data)) for i, data in reader.iter_segment_data(segments)]

    assert results == [(i, b"[]" if i == 3 else str(i).encode()) for i in range(10)]


def test_iter_segment_data_bounds_in_flight_segments() -> None:
    """No more than SEGMENT_DOWNLOAD_WINDOW segments may be downloaded ahead of the consumer."""
    segments = [_meta(i) for i in range(reader.SEGMENT_DOWNLOAD_WINDOW * 5)]
    lock = threading.Lock()
    started = 0
    consumed = 0
    max_ahead = 0

    def fake_download(
        segment: RecordingSegmentStorageMeta,
    ) -> tuple[memoryview | None, memoryview] | None:
        nonlocal started, max_ahead
        with lock:
            started += 1
            max_ahead = max(max_ahead, started - consumed)
        time.sleep(0.001)
        return None, memoryview(b"[]")

    with mock.patch.object(reader, "_download_segment", side_effect=fake_download):
        for _ in reader.iter_segment_data(segments):
            with lock:
                consumed += 1

    assert consumed == len(segments)
    assert max_ahead <= reader.SEGMENT_DOWNLOAD_WINDOW
