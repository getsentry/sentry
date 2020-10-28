from __future__ import absolute_import

import responses

from requests.exceptions import ReadTimeout
from sentry.integrations.bitbucket_server import BitbucketServerIntegrationProvider
from sentry.models import Identity, IdentityProvider, Integration, OrganizationIntegration
from sentry.testutils import IntegrationTestCase
from .testutils import EXAMPLE_PRIVATE_KEY


class BitbucketServerIntegrationTest(IntegrationTestCase):
    provider = BitbucketServerIntegrationProvider

    def test_config_view(self):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200

        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200
        self.assertContains(resp, "Connect Sentry")
        self.assertContains(resp, "Submit</button>")

    @responses.activate
    def test_validate_url(self):
        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            "url": "bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 200
        self.assertContains(resp, "Enter a valid URL")

    @responses.activate
    def test_validate_private_key(self):
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=503,
        )

        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": "hot-garbage",
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 200
        self.assertContains(
            resp, "Private key must be a valid SSH private key encoded in a PEM format."
        )

    @responses.activate
    def test_validate_consumer_key_length(self):
        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            "url": "bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "x" * 201,
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 200
        self.assertContains(resp, "Consumer key is limited to 200")

    @responses.activate
    def test_authentication_request_token_timeout(self):
        timeout = ReadTimeout("Read timed out. (read timeout=30)")
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            body=timeout,
        )

        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 200
        self.assertContains(resp, "Setup Error")
        self.assertContains(resp, "request token from Bitbucket")
        self.assertContains(resp, "Timed out")

    @responses.activate
    def test_authentication_request_token_fails(self):
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=503,
        )

        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 200
        self.assertContains(resp, "Setup Error")
        self.assertContains(resp, "request token from Bitbucket")

    @responses.activate
    def test_authentication_request_token_redirect(self):
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=abc123&oauth_token_secret=def456",
        )

        # Start pipeline
        self.client.get(self.init_path)

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 302
        redirect = (
            "https://bitbucket.example.com/plugins/servlet/oauth/authorize?oauth_token=abc123"
        )
        assert redirect == resp["Location"]

    @responses.activate
    def test_authentication_access_token_failure(self):
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=abc123&oauth_token_secret=def456",
        )
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/access-token",
            status=500,
            content_type="text/plain",
            body="<html>it broke</html>",
        )

        # Get config page
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 302
        assert resp["Location"]

        resp = self.client.get(self.setup_path + "?oauth_token=xyz789")
        assert resp.status_code == 200
        self.assertContains(resp, "Setup Error")
        self.assertContains(resp, "access token from Bitbucket")

    def install_integration(self):
        # Get config page
        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 302
        assert resp["Location"]

        resp = self.client.get(self.setup_path + "?oauth_token=xyz789")
        assert resp.status_code == 200

        return resp

    @responses.activate
    def test_authentication_verifier_expired(self):
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=abc123&oauth_token_secret=def456",
        )
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/access-token",
            status=404,
            content_type="text/plain",
            body="oauth_error=token+expired",
        )

        # Try getting the token but it has expired for some reason,
        # perhaps a stale reload/history navigate.
        resp = self.install_integration()

        self.assertContains(resp, "Setup Error")
        self.assertContains(resp, "access token from Bitbucket")

    @responses.activate
    def test_authentication_success(self):
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=abc123&oauth_token_secret=def456",
        )
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/access-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=valid-token&oauth_token_secret=valid-secret",
        )
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/rest/webhooks/1.0/webhook",
            status=204,
            body="",
        )

        self.install_integration()

        integration = Integration.objects.get()
        assert integration.name == "sentry-bot"
        assert integration.metadata["domain_name"] == "bitbucket.example.com"
        assert integration.metadata["base_url"] == "https://bitbucket.example.com"
        assert integration.metadata["verify_ssl"] is False

        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization=self.organization
        )
        assert org_integration.config == {}

        idp = IdentityProvider.objects.get(type="bitbucket_server")
        identity = Identity.objects.get(
            idp=idp, user=self.user, external_id="bitbucket.example.com:sentry-bot"
        )
        assert identity.data["consumer_key"] == "sentry-bot"
        assert identity.data["access_token"] == "valid-token"
        assert identity.data["access_token_secret"] == "valid-secret"
        assert identity.data["private_key"] == EXAMPLE_PRIVATE_KEY

    @responses.activate
    def test_setup_external_id_length(self):
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=abc123&oauth_token_secret=def456",
        )
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/access-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=valid-token&oauth_token_secret=valid-secret",
        )
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/rest/webhooks/1.0/webhook",
            status=204,
            body="",
        )

        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "a-very-long-consumer-key-that-when-combined-with-host-would-overflow",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 302
        redirect = (
            "https://bitbucket.example.com/plugins/servlet/oauth/authorize?oauth_token=abc123"
        )
        assert redirect == resp["Location"]

        resp = self.client.get(self.setup_path + "?oauth_token=xyz789")
        assert resp.status_code == 200

        integration = Integration.objects.get(provider="bitbucket_server")
        assert (
            integration.external_id
            == "bitbucket.example.com:a-very-long-consumer-key-that-when-combine"
        )
