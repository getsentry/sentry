import pytest

from sentry.utils.codecs import BytesCodec, JSONCodec, ZlibCodec, ZstdCodec


@pytest.mark.parametrize(
    "codec, decoded, encoded",
    [
        (JSONCodec(), {"foo": "bar"}, '{"foo":"bar"}'),
        (BytesCodec("utf8"), "\N{SNOWMAN}", b"\xe2\x98\x83"),
        (ZlibCodec(), b"hello", b"x\x9c\xcbH\xcd\xc9\xc9\x07\x00\x06,\x02\x15"),
        (ZstdCodec(), b"hello", b"(\xb5/\xfd \x05)\x00\x00hello"),
    ],
)
def test_codec(codec, encoded, decoded):
    assert codec.encode(decoded) == encoded
    assert codec.decode(encoded) == decoded


def test_codec_chaining() -> None:
    codec = JSONCodec() | BytesCodec()

    assert codec.encode([1, 2, 3]) == b"[1,2,3]"
    assert codec.decode(b"[1,2,3]") == [1, 2, 3]
