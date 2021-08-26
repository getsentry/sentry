from sentry.models import Project
from sentry.sentry_metrics.indexer.mock import MockIndexer, UseCase

INDEXER = MockIndexer()


def test_resolve():
    mock_project = Project()
    assert INDEXER.resolve(mock_project, UseCase.METRIC, "what") is None
    assert INDEXER.resolve(mock_project, UseCase.METRIC, "user") == 11


def test_reverse_resolve():
    mock_project = Project()
    assert INDEXER.reverse_resolve(mock_project, UseCase.METRIC, 666) is None
    assert INDEXER.reverse_resolve(mock_project, UseCase.METRIC, 11) == "user"


def test_list_metrics():
    mock_project = Project()
    assert INDEXER.list_metrics(mock_project) == ["session.duration", "session", "user"]


def test_list_tag_keys():
    mock_project = Project()
    assert INDEXER.list_tag_keys(mock_project) == ["environment", "session.status"]


def test_list_tag_values():
    mock_project = Project()
    assert INDEXER.list_tag_values(mock_project, "environment") == ["production", "staging"]
