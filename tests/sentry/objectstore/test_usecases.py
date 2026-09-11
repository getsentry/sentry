from datetime import timedelta

from objectstore_client import TimeToIdle

from sentry.objectstore import UsecaseId


def test_snapshots_usecase_config() -> None:
    usecase = UsecaseId.SNAPSHOTS.create()
    assert usecase.name == "snapshots"
    assert usecase._expiration_policy == TimeToIdle(timedelta(days=30))
