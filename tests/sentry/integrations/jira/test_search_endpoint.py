from __future__ import absolute_import

import json

from mock import patch

from django.core.urlresolvers import reverse

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
            name='Example JIRA',
        )
        integration.add_organization(org.id)

        path = reverse('sentry-extensions-jira-search', args=[org.slug, integration.id])

        resp = self.client.get('%s?field=issue_id&query=test' % (path,))
        assert resp.data == [
            {'text': '(HSP-1) this is a test issue summary', 'id': 'HSP-1'}
        ]
        mock_search_issues.assert_called_with('test')
