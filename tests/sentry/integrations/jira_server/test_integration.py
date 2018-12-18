from __future__ import absolute_import

import jwt

from sentry.integrations.jira_server import JiraServerIntegrationProvider
from sentry.models import (
    Identity,
    IdentityProvider,
    Integration,
    OrganizationIntegration
)
from sentry.testutils import IntegrationTestCase
from sentry.utils import json
from .testutils import EXAMPLE_PRIVATE_KEY

import responses


class JiraServerIntegrationTest(IntegrationTestCase):
    provider = JiraServerIntegrationProvider

    def test_config_view(self):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200

        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200
        self.assertContains(resp, 'Connect Sentry')
        self.assertContains(resp, 'Submit</button>')

    @responses.activate
    def test_authentication_request_token_fails(self):
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/request-token',
            status=503)

        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            'url': 'https://jira.example.com/',
            'verify_ssl': False,
            'consumer_key': 'sentry-bot',
            'private_key': EXAMPLE_PRIVATE_KEY
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 200
        self.assertContains(resp, 'Setup Error')
        self.assertContains(resp, 'request token from Jira')

    @responses.activate
    def test_authentication_request_token_redirect(self):
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/request-token',
            status=200,
            content_type='text/plain',
            body='oauth_token=abc123&oauth_token_secret=def456')

        # Start pipeline
        self.client.get(self.init_path)

        # Submit credentials
        data = {
            'url': 'https://jira.example.com/',
            'verify_ssl': False,
            'consumer_key': 'sentry-bot',
            'private_key': EXAMPLE_PRIVATE_KEY
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 302
        redirect = 'https://jira.example.com/plugins/servlet/oauth/authorize?oauth_token=abc123'
        assert redirect == resp['Location']

    @responses.activate
    def test_authentication_access_token_failure(self):
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/request-token',
            status=200,
            content_type='text/plain',
            body='oauth_token=abc123&oauth_token_secret=def456')
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/access-token',
            status=500,
            content_type='text/plain',
            body='<html>it broke</html>')

        # Get config page
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200

        # Submit credentials
        data = {
            'url': 'https://jira.example.com/',
            'verify_ssl': False,
            'consumer_key': 'sentry-bot',
            'private_key': EXAMPLE_PRIVATE_KEY
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 302
        assert resp['Location']

        resp = self.client.get(self.setup_path + '?oauth_token=xyz789')
        assert resp.status_code == 200
        self.assertContains(resp, 'Setup Error')
        self.assertContains(resp, 'access token from Jira')

    def install_integration(self):
        # Get config page
        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200

        # Submit credentials
        data = {
            'url': 'https://jira.example.com/',
            'verify_ssl': False,
            'consumer_key': 'sentry-bot',
            'private_key': EXAMPLE_PRIVATE_KEY
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 302
        assert resp['Location']

        resp = self.client.get(self.setup_path + '?oauth_token=xyz789')
        assert resp.status_code == 200

        return resp

    @responses.activate
    def test_authentication_verifier_expired(self):
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/request-token',
            status=200,
            content_type='text/plain',
            body='oauth_token=abc123&oauth_token_secret=def456')
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/access-token',
            status=404,
            content_type='text/plain',
            body='oauth_error=token+expired')

        # Try getting the token but it has expired for some reason,
        # perhaps a stale reload/history navigate.
        resp = self.install_integration()

        self.assertContains(resp, 'Setup Error')
        self.assertContains(resp, 'access token from Jira')

    @responses.activate
    def test_authentication_success(self):
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/request-token',
            status=200,
            content_type='text/plain',
            body='oauth_token=abc123&oauth_token_secret=def456')
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/access-token',
            status=200,
            content_type='text/plain',
            body='oauth_token=valid-token&oauth_token_secret=valid-secret')
        responses.add(
            responses.POST,
            'https://jira.example.com/rest/webhooks/1.0/webhook',
            status=204,
            body='')

        self.install_integration()

        integration = Integration.objects.get()
        assert integration.name == 'sentry-bot'
        assert integration.metadata['domain_name'] == 'jira.example.com'
        assert integration.metadata['base_url'] == 'https://jira.example.com'
        assert integration.metadata['verify_ssl'] is False
        assert integration.metadata['webhook_secret']

        org_integration = OrganizationIntegration.objects.get(
            integration=integration,
            organization=self.organization)
        assert org_integration.config == {}

        idp = IdentityProvider.objects.get(type='jira_server')
        identity = Identity.objects.get(
            idp=idp,
            user=self.user,
            external_id='jira.example.com:sentry-bot',
        )
        assert identity.data['consumer_key'] == 'sentry-bot'
        assert identity.data['access_token'] == 'valid-token'
        assert identity.data['access_token_secret'] == 'valid-secret'
        assert identity.data['private_key'] == EXAMPLE_PRIVATE_KEY

    @responses.activate
    def test_setup_create_webhook(self):
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/request-token',
            status=200,
            content_type='text/plain',
            body='oauth_token=abc123&oauth_token_secret=def456')
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/access-token',
            status=200,
            content_type='text/plain',
            body='oauth_token=valid-token&oauth_token_secret=valid-secret')

        expected_id = 'jira.example.com:sentry-bot'

        def webhook_response(request):
            # Ensure the webhook token contains our integration
            # external id
            data = json.loads(request.body)
            url = data['url']
            token = url.split('/')[-2]
            token_data = jwt.decode(token, verify=False)
            assert 'id' in token_data
            assert token_data['id'] == expected_id

            return (204, {}, '')

        responses.add_callback(
            responses.POST,
            'https://jira.example.com/rest/webhooks/1.0/webhook',
            callback=webhook_response)
        self.install_integration()

        integration = Integration.objects.get()
        assert integration.external_id == expected_id

    @responses.activate
    def test_setup_create_webhook_failure(self):
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/request-token',
            status=200,
            content_type='text/plain',
            body='oauth_token=abc123&oauth_token_secret=def456')
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/access-token',
            status=200,
            content_type='text/plain',
            body='oauth_token=valid-token&oauth_token_secret=valid-secret')
        responses.add(
            responses.POST,
            'https://jira.example.com/rest/webhooks/1.0/webhook',
            status=502,
            body='Bad things')

        resp = self.install_integration()
        self.assertContains(resp, 'webhook')

        assert Integration.objects.count() == 0

    @responses.activate
    def test_setup_create_webhook_failure_forbidden(self):
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/request-token',
            status=200,
            content_type='text/plain',
            body='oauth_token=abc123&oauth_token_secret=def456')
        responses.add(
            responses.POST,
            'https://jira.example.com/plugins/servlet/oauth/access-token',
            status=200,
            content_type='text/plain',
            body='oauth_token=valid-token&oauth_token_secret=valid-secret')
        responses.add(
            responses.POST,
            'https://jira.example.com/rest/webhooks/1.0/webhook',
            status=403,
            json={"messages": [
                {
                    "key": "You do not have permission to create WebHook 'Sentry Issue Sync'."
                }
            ]})

        resp = self.install_integration()
        self.assertContains(resp, 'You do not have permission to create')
        self.assertContains(resp, 'Could not create issue webhook')

        assert Integration.objects.count() == 0
