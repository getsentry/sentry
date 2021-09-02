from sentry.models import Organization
from sentry.sentry_metrics.indexer.mock import MockIndexer, UseCase

INDEXER = MockIndexer()


def test_resolve():
    mock_org = Organization()
    assert INDEXER.resolve(mock_org, UseCase.METRIC, "what") is None
    assert INDEXER.resolve(mock_org, UseCase.METRIC, "user") == 11


def test_reverse_resolve():
    mock_org = Organization()
    assert INDEXER.reverse_resolve(mock_org, UseCase.METRIC, 666) is None
    assert INDEXER.reverse_resolve(mock_org, UseCase.METRIC, 11) == "user"
