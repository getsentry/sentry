import io
from collections.abc import Iterator
from typing import Protocol


class MalformedRangeHeader(Exception):
    pass


class UnsatisfiableRange(Exception):
    pass


class RangeProtocol(Protocol):
    def make_range(self, last_index: int) -> tuple[int, int]: ...

    def read_range(self, bytes: io.BytesIO) -> bytes:
        """Return a byte range from a reader.

        The rules governing the range are derived from the implementation class.
        """
        ...


class BoundedRange:
    """Bounded range header.

    A bounded range header is a pair of integers representing the inclusive range of a
    unit in the resource.
    """

    def __init__(self, start: int, end: int) -> None:
        self.start = start
        self.end = end

    def make_range(self, last_index: int) -> tuple[int, int]:
        if self.start > last_index or self.end < self.start or self.start < 0:
            raise UnsatisfiableRange()

        return (self.start, min(last_index, self.end))

    def read_range(self, bytes: io.BytesIO) -> bytes:
        start_index, end_index = self.make_range(bytes.getbuffer().nbytes - 1)
        bytes.seek(start_index)
        return bytes.read(end_index - start_index + 1)


class UnboundedRange:
    """Unbounded range header.

    An unbounded range header is an integer in the given unit indicating the start
    position of the request range with no ending byte. Start range headers read to
    the end of the resource.
    """

    def __init__(self, start: int) -> None:
        self.start = start

    def make_range(self, last_index: int) -> tuple[int, int]:
        if self.start > last_index or self.start < 0:
            raise UnsatisfiableRange()

        return (self.start, last_index)

    def read_range(self, bytes: io.BytesIO) -> bytes:
        start_index, _ = self.make_range(bytes.getbuffer().nbytes - 1)
        bytes.seek(start_index)
        return bytes.read()


class SuffixLength:
    """Suffix length range header.

    A suffix length range is an integer indicating the number of units at the end
    of the resource to return.
    """

    def __init__(self, suffix_length: int) -> None:
        self.suffix_length = suffix_length

    def make_range(self, last_index: int) -> tuple[int, int]:
        if self.suffix_length <= 0:
            raise UnsatisfiableRange()

        return (max(0, last_index - self.suffix_length + 1), last_index)

    def read_range(self, bytes: io.BytesIO) -> bytes:
        start_index, _ = self.make_range(bytes.getbuffer().nbytes - 1)
        bytes.seek(start_index)
        return bytes.read()


def parse_range_header(header: str) -> list[RangeProtocol]:
    """Return an eagerly accumulated list of ranges."""
    return list(iter_range_header(header))


def iter_range_header(header: str) -> Iterator[RangeProtocol]:
    """Lazily iterate over a range of bytes."""
    unit, separator, ranges = header.partition("=")
    if separator != "=":
        raise MalformedRangeHeader("Expected `=` symbol")
    elif unit != "bytes":
        raise MalformedRangeHeader("Unsupported unit. Expected bytes")

    for range in ranges.replace(" ", "").split(","):
        start, separator, end = range.partition("-")
        if separator != "-":
            raise MalformedRangeHeader("Expected `-` symbol")

        if start == "":
            yield SuffixLength(_range_value(end))
        elif end == "":
            yield UnboundedRange(_range_value(start))
        else:
            yield BoundedRange(_range_value(start), _range_value(end))


def _range_value(value: str) -> int:
    """Parse a string to an integer or err."""
    if not isinstance(value, str):
        raise Exception("Malformed type input.")

    try:
        signed_int = int(value)
        if signed_int < 0:
            raise MalformedRangeHeader("Ranges must be positive integer values")
        return signed_int
    except ValueError:
        raise MalformedRangeHeader(f"Expected value of type integer; received: {value}")


def content_length(offsets: list[tuple[int, int]]) -> int:
    return sum(end - start + 1 for start, end in offsets)


def content_range(offset: tuple[int, int], resource_size: int) -> str:
    return f"bytes {f'{offset[0]}-{offset[1]}'}/{resource_size}"
