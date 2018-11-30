from __future__ import absolute_import

import responses

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import (
    Integration,
    IdentityProvider,
    Identity,
    IdentityStatus
)
from sentry.testutils import APITestCase
from .testutils import (
    EXAMPLE_PRIVATE_KEY,
    EXAMPLE_ISSUE_SEARCH,
)


class JiraSearchEndpointTest(APITestCase):

    @fixture
    def integration(self):
        integration = Integration.objects.create(
            provider='jira_server',
            name='Example Jira',
            metadata={
                'verify_ssl': False,
                'base_url': 'https://jira.example.org',
            }
        )
        identity_provider = IdentityProvider.objects.create(
            external_id='jira.example.org:sentry-test',
            type='jira_server',
        )
        identity = Identity.objects.create(
            idp=identity_provider,
            user=self.user,
            scopes=(),
            status=IdentityStatus.VALID,
            data={
                'consumer_key': 'sentry-test',
                'private_key': EXAMPLE_PRIVATE_KEY,
                'access_token': 'access-token',
                'access_token_secret': 'access-token-secret',
            }
        )
        integration.add_organization(
            self.organization,
            self.user,
            default_auth_id=identity.id)
        return integration

    @responses.activate
    def test_get_success_text_search(self):
        org = self.organization
        integration = self.integration
        responses.add(
            responses.GET,
            'https://jira.example.org/rest/api/2/search/?jql=text ~ "test"',
            body=EXAMPLE_ISSUE_SEARCH,
            content_type='json'
        )

        self.login_as(self.user)
        path = reverse('sentry-extensions-jiraserver-search', args=[org.slug, integration.id])
        resp = self.client.get('%s?field=externalIssue&query=test' % (path,))

        assert resp.status_code == 200
        assert resp.data == [
            {'label': '(HSP-1) this is a test issue summary', 'value': 'HSP-1'}
        ]

    @responses.activate
    def test_get_success_id_search(self):
        org = self.organization
        integration = self.integration
        responses.add(
            responses.GET,
            'https://jira.example.org/rest/api/2/search/?jql=id="HSP-1"',
            body=EXAMPLE_ISSUE_SEARCH,
            content_type='json'
        )

        self.login_as(self.user)
        path = reverse('sentry-extensions-jiraserver-search', args=[org.slug, integration.id])
        resp = self.client.get('%s?field=externalIssue&query=HSP-1' % (path,))

        assert resp.status_code == 200
        assert resp.data == [
            {'label': '(HSP-1) this is a test issue summary', 'value': 'HSP-1'}
        ]

    @responses.activate
    def test_get_network_error(self):
        org = self.organization
        integration = self.integration
        responses.add(
            responses.GET,
            'https://jira.example.org/rest/api/2/search/?jql=id="HSP-1"',
            status=502,
            body='<p>We are down</p>'
        )

        self.login_as(self.user)
        path = reverse('sentry-extensions-jiraserver-search', args=[org.slug, integration.id])
        resp = self.client.get('%s?field=externalIssue&query=HSP-1' % (path,))

        assert resp.status_code == 400

    def test_get_missing_integration(self):
        self.login_as(self.user)
        org = self.organization

        path = reverse('sentry-extensions-jiraserver-search', args=[org.slug, 99])
        resp = self.client.get('%s?field=externalIssue&query=HSP-1' % (path,))

        assert resp.status_code == 404
