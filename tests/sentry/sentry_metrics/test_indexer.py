from sentry.sentry_metrics.indexer.mock import MockIndexer

INDEXER = MockIndexer()


def test_resolve():
    assert INDEXER.resolve("what") is None
    assert INDEXER.resolve("sentry.sessions.user") == 11


def test_reverse_resolve():
    assert INDEXER.reverse_resolve(666) is None
    assert INDEXER.reverse_resolve(11) == "sentry.sessions.user"
