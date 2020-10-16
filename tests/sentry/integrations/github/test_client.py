from __future__ import absolute_import

import responses
from sentry.utils.compat import mock

from sentry.testutils import TestCase
from sentry.models import Integration


class GitHubAppsClientTest(TestCase):
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_save_token(self, get_jwt):

        integration = Integration.objects.create(
            provider="github",
            name="Github Test Org",
            external_id="1",
            metadata={"access_token": None, "expires_at": None},
        )

        install = integration.get_installation(organization_id="123")
        client = install.get_client()

        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            status=200,
            content_type="application/json",
        )

        token = client.get_token()
        assert token == "12345token"
        assert len(responses.calls) == 1

        # Second get_token doesn't have to make an API call
        token = client.get_token()
        assert token == "12345token"
        assert len(responses.calls) == 1

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_check_source_code_link(self, get_jwt):
        integration = Integration.objects.create(
            provider="github",
            name="Github Test Org",
            external_id="1",
            metadata={"access_token": None, "expires_at": None},
        )

        install = integration.get_installation(organization_id="123")
        client = install.get_client()

        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            status=200,
            content_type="application/json",
        )

        path = u"https://github.com/getsentry/sentry/blob/master/src/sentry/integrations/github/client.py#L22"

        responses.add(
            method=responses.HEAD, url=path, status=200,
        )

        resp = client.check_source_code_link(path)
        assert resp == 200

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_check_bad_source_code_link(self, get_jwt):
        integration = Integration.objects.create(
            provider="github",
            name="Github Test Org",
            external_id="1",
            metadata={"access_token": None, "expires_at": None},
        )

        install = integration.get_installation(organization_id="123")
        client = install.get_client()

        responses.add(
            method=responses.POST,
            url="https://api.github.com/app/installations/1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            status=200,
            content_type="application/json",
        )

        path = u"https://github.com/getsentry/sentry/blob/master/src/santry/integrations/github/client.py#L22"

        responses.add(
            method=responses.HEAD, url=path, status=404,
        )

        resp = client.check_source_code_link(path)
        assert resp == 404
