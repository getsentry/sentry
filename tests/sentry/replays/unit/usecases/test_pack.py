from sentry.replays.usecases.pack import HEADER_OFFSET, Encoding, pack, unpack


def test_pack_rrweb():
    result = pack(b"hello", None)
    assert result[0] == Encoding.RRWEB.value
    assert result[1:] == b"hello"


def test_pack_rrweb_video():
    result = pack(b"hello", b"world")
    assert result[0] == Encoding.VIDEO.value

    length = int.from_bytes(result[1:HEADER_OFFSET])
    assert result[HEADER_OFFSET : HEADER_OFFSET + length] == b"world"
    assert result[HEADER_OFFSET + length :] == b"hello"


def test_unpack_rrweb():
    assert unpack(pack(b"hello", None)) == (None, b"hello")


def test_unpack_rrweb_video():
    assert unpack(pack(b"hello", b"world")) == (b"world", b"hello")

    x = b"\x00" * 1_000_000
    y = b"\xff" * 1_000_000
    assert unpack(pack(x, y)) == (y, x)
