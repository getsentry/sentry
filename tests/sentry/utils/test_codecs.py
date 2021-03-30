from sentry.utils.codecs import BytesCodec, JSONCodec


def test_codec_chaining() -> None:
    codec = JSONCodec() | BytesCodec()

    assert codec.encode([1, 2, 3]) == b"[1,2,3]"
    assert codec.decode(b"[1,2,3]") == [1, 2, 3]
