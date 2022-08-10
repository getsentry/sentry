import pytest

from sentry.sentry_metrics.indexer.cloudspanner import IdCodec
from sentry.sentry_metrics.indexer.id_generator import get_id


@pytest.mark.parametrize(
    "value",
    (12345, 0, pow(2, 64) - 1, get_id()),
)
def test_id_codec(value) -> None:
    codec = IdCodec()
    encoded = codec.encode(value)
    # Ensure it is in allowed range
    assert encoded >= -9223372036854775808
    assert encoded <= 9223372036854775807

    assert value == codec.decode(encoded)
