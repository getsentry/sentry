from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.snuba.metrics.naming_layer import SessionMRI

INDEXER = MockIndexer()


def test_resolve():
    assert INDEXER.resolve(1, "what") is None
    assert INDEXER.resolve(1, SessionMRI.USER.value) == 3
    # hardcoded values don't depend on org_id
    assert INDEXER.resolve(0, SessionMRI.USER.value) == 3


def test_reverse_resolve():
    assert INDEXER.reverse_resolve(666) is None
    assert INDEXER.reverse_resolve(3) == SessionMRI.USER.value
