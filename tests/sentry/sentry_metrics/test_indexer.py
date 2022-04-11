from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.snuba.metrics.naming_layer import SessionMRI

INDEXER = MockIndexer()


def test_resolve():
    assert INDEXER.resolve(1, "what") is None
    assert INDEXER.resolve(1, SessionMRI.USER.value) == 11


def test_reverse_resolve():
    assert INDEXER.reverse_resolve(666) is None
    assert INDEXER.reverse_resolve(11) == SessionMRI.USER.value
