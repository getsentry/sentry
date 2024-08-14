from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.sentry_metrics.indexer.strings import SHARED_STRINGS
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer import SessionMRI

INDEXER = MockIndexer()


def test_resolve():
    assert INDEXER.resolve(UseCaseID.SESSIONS, 1, "what") is None
    assert (
        INDEXER.resolve(UseCaseID.SESSIONS, 1, SessionMRI.RAW_USER.value)
        == SHARED_STRINGS[SessionMRI.RAW_USER.value]
    )
    # hardcoded values don't depend on org_id
    assert (
        INDEXER.resolve(UseCaseID.SESSIONS, 0, SessionMRI.RAW_USER.value)
        == SHARED_STRINGS[SessionMRI.RAW_USER.value]
    )


def test_reverse_resolve():
    assert INDEXER.reverse_resolve(UseCaseID.SESSIONS, 1, 666) is None
    id = SHARED_STRINGS[SessionMRI.RAW_USER.value]
    assert INDEXER.reverse_resolve(UseCaseID.SESSIONS, 1, id) == SessionMRI.RAW_USER.value
