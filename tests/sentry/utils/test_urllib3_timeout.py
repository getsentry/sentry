from __future__ import absolute_import

from sentry.utils.compat import mock
import pytest

from urllib3 import HTTPConnectionPool
from urllib3.exceptions import HTTPError, ReadTimeoutError

from sentry.utils.snuba import RetrySkipTimeout


class FakeConnectionPool(HTTPConnectionPool):
    def __init__(self, connection, **kwargs):
        self.connection = connection
        super(FakeConnectionPool, self).__init__(**kwargs)

    def _new_conn(self):
        return self.connection


def test_retries():
    """
    Tests that, even if I set up 5 retries, there is only one request
    made since it times out.
    """
    connection_mock = mock.Mock()
    connection_mock.request.side_effect = ReadTimeoutError(None, "test.com", "Timeout")

    snuba_pool = FakeConnectionPool(
        connection=connection_mock,
        host="www.test.com",
        port=80,
        retries=RetrySkipTimeout(total=5, method_whitelist={"GET", "POST"}),
        timeout=30,
        maxsize=10,
    )

    with pytest.raises(HTTPError):
        snuba_pool.urlopen("POST", "/query", body="{}")

    assert connection_mock.request.call_count == 1
