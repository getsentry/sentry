from datetime import timedelta

from objectstore_client import TimeToLive

from sentry.objectstore import UsecaseId, get_session
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_objectstore


@requires_objectstore
class PreprodUsecaseTest(TestCase):
    def test_default_and_explicit_ttl(self) -> None:
        for usecase in (
            UsecaseId.PREPROD_ARTIFACTS,
            UsecaseId.PREPROD_DISTRIBUTION,
            UsecaseId.PREPROD_SIZE,
        ):
            with self.subTest(usecase=usecase):
                session = get_session(usecase, self.project)
                key = session.put(b"build payload")
                self.addCleanup(session.delete, key)
                metadata = session.head(key)
                assert metadata is not None
                assert metadata.expiration_policy == TimeToLive(timedelta(days=30))

                override = TimeToLive(timedelta(days=90))
                session.put(b"build payload", key=key, expiration_policy=override)
                metadata = session.head(key)
                assert metadata is not None
                assert metadata.expiration_policy == override
