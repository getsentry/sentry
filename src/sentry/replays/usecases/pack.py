"""Packed binary encoding module.

Bytes are packed in varying formats dependent on their type. The type is
determined by the first byte and is an 8-bit integer. 0 for rrweb, 1 for
video. For backwards compatibility reasons the maximum type byte allowed
is 90 (91 being the ascii encoding for `[` which is the leading character
of a JSON array).

The RRWeb type exclusively contains rrweb json after the type byte. The
video type contains an 4-byte length header followed by video bytes
followed by rrweb bytes. The length bytes encode offset information
detailing how to split the rrweb payload from the video payload.

A type byte is not always specified. Past encodings will lead with the
binary encoding for the `[` character. These are considered rrweb type
payloads and can be returned as is.
"""

from enum import Enum

USIZE = 4  # Unsigned integer word size.
HEADER_OFFSET = USIZE + 1  # word size + type byte.


class Encoding(Enum):
    RRWEB = 0
    VIDEO = 1


def pack(rrweb: bytes, video: bytes | None) -> bytes:
    def _to_uint_bytes(length):
        return bytes([(length >> (i * 8)) & 0xFF for i in range(USIZE - 1, -1, -1)])

    if video is None:
        return b"\x00" + rrweb
    else:
        return b"\x01" + _to_uint_bytes(len(video)) + video + rrweb


def unpack(obj: bytes):
    mv = memoryview(obj)
    if mv[0] == 91:  # Not packed.
        return (None, mv)
    elif mv[0] == Encoding.RRWEB.value:
        return _unpack_rrweb(mv)
    elif mv[0] == Encoding.VIDEO.value:
        return _unpack_video(mv)
    else:
        return (None, mv)


def _unpack_rrweb(mv: memoryview) -> tuple[None, memoryview]:
    return (None, mv[1:])


def _unpack_video(mv: memoryview) -> tuple[memoryview, memoryview]:
    end = int.from_bytes(mv[1:HEADER_OFFSET]) + HEADER_OFFSET
    return (mv[HEADER_OFFSET:end], mv[end:])
