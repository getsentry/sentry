from __future__ import absolute_import

import json

from mock import patch

from django.core.urlresolvers import reverse

from sentry.integrations.bitbucket.client import BitbucketApiClient
from sentry.models import Integration
from sentry.testutils import APITestCase

SAMPLE_ISSUE_SEARCH_RESPONSE = """
{
    "values": [
        {
            "title": "Sample issue, fix meh",
            "id": 5
        }
    ]
}
"""

SAMPLE_REPO_SEARCH_RESPONSE = """
{
    "values": [
        {
            "name": "Apples",
            "full_name": "meredithanya/apples"
        }
    ]
}
"""


class BitbucketSearchEndpointTest(APITestCase):
    def setUp(self):
        self.base_url = 'https://api.bitbucket.org'
        self.shared_secret = '234567890'
        self.subject = 'connect:1234567'
        self.integration = Integration.objects.create(
            provider='bitbucket',
            external_id=self.subject,
            name='Sample BB',
            metadata={
                'base_url': self.base_url,
                'shared_secret': self.shared_secret,
                'subject': self.subject,
            }
        )

    @patch.object(BitbucketApiClient, 'search_issues',
                  return_value=json.loads(SAMPLE_ISSUE_SEARCH_RESPONSE.strip()))
    def test_search_issues(self, mock_search_issues):
        org = self.organization
        self.login_as(self.user)

        self.integration.add_organization(org, self.user)

        path = reverse('sentry-extensions-bitbucket-search', args=[org.slug, self.integration.id])
        resp = self.client.get('%s?field=externalIssue&repo=meredithanya&query=issue' % (path,))
        assert resp.data == [
            {'label': '#5 Sample issue, fix meh', 'value': 5}
        ]
        mock_search_issues.assert_called_with('meredithanya', 'title~"issue"')

    @patch.object(BitbucketApiClient, 'search_repositories',
                  return_value=json.loads(SAMPLE_REPO_SEARCH_RESPONSE.strip()))
    def test_search_repositories(self, mock_search_repositories):
        org = self.organization
        self.login_as(self.user)

        self.integration.add_organization(org, self.user)

        path = reverse('sentry-extensions-bitbucket-search', args=[org.slug, self.integration.id])
        resp = self.client.get('%s?field=repo&query=apple' % (path,))
        assert resp.data == [
            {'label': 'meredithanya/apples', 'value': 'meredithanya/apples'}
        ]
        mock_search_repositories.assert_called_with('Sample BB', 'name~"apple"')
