from sentry.models import Organization
from sentry.sentry_metrics.indexer.mock import MockIndexer

INDEXER = MockIndexer()


def test_resolve():
    mock_org_id = Organization().id
    assert INDEXER.resolve(mock_org_id, "what") is None
    assert INDEXER.resolve(mock_org_id, "user") == 11


def test_reverse_resolve():
    mock_org_id = Organization().id
    assert INDEXER.reverse_resolve(mock_org_id, 666) is None
    assert INDEXER.reverse_resolve(mock_org_id, 11) == "user"
