from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.utils.compat.mock import patch

from sentry.auth.providers.github.client import GitHubClient


class MockReq:
    def __init__(self, status_code=200, content=None):
        self.status_code = status_code
        self.content = content


class MockHttp:
    def __init__(self):
        self.calledArgs = []
        self.calledKwargs = {}

    def get(self, *args, **kwargs):
        for arg in args:
            self.calledArgs.append(arg)
        self.calledKwargs = kwargs
        return MockReq()


@patch("sentry.utils.json.loads")
class GitHubClientTest(TestCase):
    def test_request_sends_client_id_and_secret(self, mock_loads):
        client = GitHubClient("clientId", "clientSecret")
        mock = MockHttp()
        client.http = mock
        client._request("/", "accessToken")

        assert "auth" in mock.calledKwargs.keys()
        assert "clientId" in mock.calledKwargs["auth"]
        assert "clientSecret" in mock.calledKwargs["auth"]
