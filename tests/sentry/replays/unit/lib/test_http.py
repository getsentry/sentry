import io

import pytest

from sentry.replays.lib.http import (
    BoundedRange,
    MalformedRangeHeader,
    SuffixLength,
    UnboundedRange,
    UnsatisfiableRange,
    iter_range_header,
    parse_range_header,
)


@pytest.mark.parametrize(
    ("start", "end", "expected"),
    (
        (0, 12, b"hello, world!"),
        (1, 12, b"ello, world!"),
        (11, 12, b"d!"),
        (12, 12, b"!"),
        (1, 2, b"el"),
        (0, 1000, b"hello, world!"),
    ),
)
def test_bounded_range(start: int, end: int, expected: bytes) -> None:
    """Test bounded range reads."""
    a = BoundedRange(start, end)
    b = io.BytesIO(b"hello, world!")
    assert a.read_range(b) == expected


@pytest.mark.parametrize(
    ("start", "end"),
    (
        (-1, 0),
        (14, 15),
        (1, 0),
    ),
)
def test_bounded_range_invalid(start: int, end: int) -> None:
    """Test invalid bounded range reads."""
    a = BoundedRange(start, end)
    b = io.BytesIO(b"hello, world!")

    with pytest.raises(UnsatisfiableRange):
        a.read_range(b)


@pytest.mark.parametrize(
    ("length", "expected"),
    (
        (13, b"hello, world!"),
        (12, b"ello, world!"),
        (2, b"d!"),
        (1, b"!"),
        (1000, b"hello, world!"),
    ),
)
def test_suffix_length(length: int, expected: bytes) -> None:
    """Test suffix length range reads."""
    a = SuffixLength(length)
    b = io.BytesIO(b"hello, world!")
    assert a.read_range(b) == expected


def test_suffix_length_invalid() -> None:
    """Test invaild suffix length range reads."""
    a = SuffixLength(-1)
    b = io.BytesIO(b"hello, world!")

    with pytest.raises(UnsatisfiableRange):
        a.read_range(b)


@pytest.mark.parametrize(
    ("start", "expected"),
    (
        (0, b"hello, world!"),
        (1, b"ello, world!"),
        (11, b"d!"),
        (12, b"!"),
    ),
)
def test_unbounded_range(start: int, expected: bytes) -> None:
    """Test unbounded range reads."""
    a = UnboundedRange(start)
    b = io.BytesIO(b"hello, world!")
    assert a.read_range(b) == expected


@pytest.mark.parametrize(("start",), ((-1,), (14,)))
def test_unbounded_range_invalid(start: int) -> None:
    """Test invalid unbounded range reads."""
    a = UnboundedRange(start)
    b = io.BytesIO(b"hello, world!")

    with pytest.raises(UnsatisfiableRange):
        a.read_range(b)


def test_parse_range_header_bounded() -> None:
    ranges = parse_range_header("bytes=1-100")
    assert isinstance(ranges, list)
    assert isinstance(ranges[0], BoundedRange)
    assert ranges[0].start == 1
    assert ranges[0].end == 100


def test_parse_range_header_suffix_length() -> None:
    ranges = parse_range_header("bytes=-100")
    assert isinstance(ranges, list)
    assert isinstance(ranges[0], SuffixLength)
    assert ranges[0].suffix_length == 100


def test_parse_range_header_unbounded() -> None:
    ranges = parse_range_header("bytes=100-")
    assert isinstance(ranges, list)
    assert isinstance(ranges[0], UnboundedRange)
    assert ranges[0].start == 100


@pytest.mark.parametrize(
    ("header",),
    (
        ("xyz=1-2",),
        ("bytes=1",),
        ("bytes=1-a",),
        ("bytes=a-1",),
        ("bytes=a-b",),
        ("1-2",),
        ("bytes=1--10",),
        ("bytes=1-10.0",),
        ("",),
        ("=-",),
        ("bytes=-",),
    ),
)
def test_parse_range_header_malformed_input(header: str) -> None:
    """Test malformed inputs error correctly."""
    with pytest.raises(MalformedRangeHeader):
        parse_range_header(header)


def test_iter_range_header() -> None:
    """Test iter_range_header function."""
    headers_generator = iter_range_header("bytes=-100, 100-500, 200-")
    headers = list(headers_generator)

    assert isinstance(headers[0], SuffixLength)
    assert headers[0].suffix_length == 100

    assert isinstance(headers[1], BoundedRange)
    assert headers[1].start == 100
    assert headers[1].end == 500

    assert isinstance(headers[2], UnboundedRange)
    assert headers[2].start == 200
