from __future__ import absolute_import

import responses

from sentry.testutils import TestCase

from sentry.auth.providers.github.client import GitHubClient
from sentry.auth.providers.github.constants import API_DOMAIN


class GitHubClientTest(TestCase):
    @responses.activate
    def test_request_sends_client_id_and_secret(self):
        responses.add(
            responses.GET, "https://{0}/".format(API_DOMAIN), json={"status": "SUCCESS"}, status=200
        )

        client = GitHubClient()
        client._request("/", "accessToken")

        assert len(responses.calls) == 1
        assert responses.calls[0].request.headers["Authorization"] == "token accessToken"
