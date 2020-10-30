from __future__ import absolute_import

import responses
from sentry.utils.compat import mock

from sentry.testutils import TestCase
from sentry.shared_integrations.exceptions import ApiError
from sentry.models import Integration


class GitHubAppsClientTest(TestCase):
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def setUp(self, get_jwt):
        integration = Integration.objects.create(
            provider="github",
            name="Github Test Org",
            external_id="1",
            metadata={"access_token": None, "expires_at": None},
        )

        install = integration.get_installation(organization_id="123")
        self.client = install.get_client()

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_save_token(self, get_jwt):

        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            status=200,
            content_type="application/json",
        )

        token = self.client.get_token()
        assert token == "12345token"
        assert len(responses.calls) == 1

        # Second get_token doesn't have to make an API call
        token = self.client.get_token()
        assert token == "12345token"
        assert len(responses.calls) == 1

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_check_file(self, get_jwt):
        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            content_type="application/json",
        )

        repo = "getsentry/sentry"
        path = "/src/sentry/integrations/github/client.py"
        version = "master"
        url = "https://api.github.com/repos/{}/contents/{}?ref={}".format(repo, path, version)

        responses.add(
            method=responses.HEAD, url=url, json={"text": 200},
        )

        resp = self.client.check_file(repo, path, version)
        assert resp.status_code == 200

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_check_no_file(self, get_jwt):
        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            content_type="application/json",
        )

        repo = "getsentry/sentry"
        path = "/src/santry/integrations/github/client.py"
        version = "master"
        url = u"https://api.github.com/repos/{}/contents/{}?ref={}".format(repo, path, version)

        responses.add(method=responses.HEAD, url=url, status=404)

        with self.assertRaises(ApiError):
            self.client.check_file(repo, path, version)
        assert responses.calls[1].response.status_code == 404
