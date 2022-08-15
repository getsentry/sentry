import pytest

from sentry.sentry_metrics.indexer.cloudspanner.cloudspanner import CloudSpannerIndexer, IdCodec
from sentry.sentry_metrics.indexer.id_generator import get_id


@pytest.mark.parametrize(
    "value",
    (
        12345,
        0,  # smallest supported id
        2**63 - 1,  # largest supported id
        get_id(),  # randomly generated id
    ),
)
def test_id_codec(value) -> None:
    codec = IdCodec()
    encoded = codec.encode(value)
    # Ensure it is in allowed range
    assert encoded >= -9223372036854775808
    assert encoded <= 9223372036854775807

    assert value == codec.decode(encoded)


@pytest.mark.skip(reason="TODO: Implement it correctly")
def test_spanner_indexer_service():
    # TODO: Provide instance_id and database_id when running the test
    span_indexer = CloudSpannerIndexer(instance_id="", database_id="")
    span_indexer.validate()
