from unittest import TestCase

import sentry_sdk


class TestDsn(TestCase):
    def test_dsn(self):
        client = sentry_sdk.get_client()
        assert client.dsn is None
