from __future__ import absolute_import

import json

from mock import patch

from django.core.urlresolvers import reverse

from sentry.integrations.exceptions import IntegrationError
from sentry.integrations.jira import JiraIntegration
from sentry.models import Integration
from sentry.testutils import APITestCase


SAMPLE_SEARCH_RESPONSE = """
{
  "expand": "names,schema",
  "startAt": 0,
  "maxResults": 50,
  "total": 1,
  "issues": [
    {
      "expand": "",
      "id": "10001",
      "self": "http://www.example.com/jira/rest/api/2/issue/10001",
      "key": "HSP-1",
      "fields": {
        "summary": "this is a test issue summary"
      }
    }
  ],
  "warningMessages": [
    "The value 'splat' does not exist for the field 'Foo'."
  ]
}
"""


class JiraSearchEndpointTest(APITestCase):
    @patch.object(JiraIntegration, 'search_issues',
                  return_value=json.loads(SAMPLE_SEARCH_RESPONSE.strip()))
    def test_simple(self, mock_search_issues):
        org = self.organization
        self.login_as(self.user)

        integration = Integration.objects.create(
            provider='jira',
            name='Example Jira',
        )
        integration.add_organization(org, self.user)

        path = reverse('sentry-extensions-jira-search', args=[org.slug, integration.id])

        resp = self.client.get('%s?field=externalIssue&query=test' % (path,))
        assert resp.status_code == 200
        assert resp.data == [
            {'label': '(HSP-1) this is a test issue summary', 'value': 'HSP-1'}
        ]
        mock_search_issues.assert_called_with('test')

    @patch.object(JiraIntegration, 'search_issues',
                  side_effect=IntegrationError('Oh no, something went wrong'))
    def test_error(self, mock_search_issues):
        org = self.organization
        self.login_as(self.user)

        integration = Integration.objects.create(
            provider='jira',
            name='Example Jira',
        )
        integration.add_organization(org, self.user)

        path = reverse('sentry-extensions-jira-search', args=[org.slug, integration.id])

        resp = self.client.get('%s?field=externalIssue&query=test' % (path,))
        assert resp.status_code == 400
        assert resp.data == {'detail': 'Oh no, something went wrong'}
        mock_search_issues.assert_called_with('test')
