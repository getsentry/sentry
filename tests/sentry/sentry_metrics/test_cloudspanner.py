import pytest

from sentry.sentry_metrics.indexer.cloudspanner import CloudSpannerIndexer


@pytest.mark.skip(reason="TODO: Implement it correctly")
def test_spanner_indexer_service():
    # TODO: Provide instance_id and database_id when running the test
    span_indexer = CloudSpannerIndexer(instance_id="", database_id="")
    span_indexer.setup()
    span_indexer.validate()
