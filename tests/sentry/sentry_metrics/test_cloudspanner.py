import pytest

from sentry.sentry_metrics.indexer.cloudspanner import CloudSpannerIndexer


@pytest.mark.skip(reason="TODO: Implement it correctly")
def test_spanner_indexer_service():
    span_indexer = CloudSpannerIndexer(
        instance_id="markus-test-spanner-pg", database_id="nikhar-test"
    )
    span_indexer.setup()
    span_indexer.validate()
