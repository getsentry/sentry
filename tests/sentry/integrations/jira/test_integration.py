from __future__ import absolute_import

import json
import mock

from django.core.urlresolvers import reverse

from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.utils.http import absolute_uri


SAMPLE_CREATE_META_RESPONSE = """
{
  "projects": [
    {
      "self": "http://www.example.com/jira/rest/api/2/project/EX",
      "id": "10000",
      "key": "EX",
      "name": "Example Project",
      "avatarUrls": {
        "48x48": "http://www.example.com/jira/secure/projectavatar?pid=10000&avatarId=10011",
        "24x24": "http://www.example.com/jira/secure/projectavatar?size=small&pid=10000&avatarId=10011",
        "16x16": "http://www.example.com/jira/secure/projectavatar?size=xsmall&pid=10000&avatarId=10011",
        "32x32": "http://www.example.com/jira/secure/projectavatar?size=medium&pid=10000&avatarId=10011"
      },
      "issuetypes": [
        {
          "self": "http://www.example.com/jira/rest/api/2/issueType/1",
          "id": "1",
          "description": "An error in the code",
          "iconUrl": "http://www.example.com/jira/images/icons/issuetypes/bug.png",
          "name": "Bug",
          "subtask": false,
          "fields": {
            "issuetype": {
              "required": true,
              "name": "Issue Type",
              "key": "issuetype",
              "hasDefaultValue": false,
              "operations": [
                "set"
              ]
            }
          }
        }
      ]
    }
  ]
}
"""

SAMPLE_PROJECT_LIST_RESPONSE = """
[
  {
    "self": "http://www.example.com/jira/rest/api/2/project/EX",
    "id": "10000",
    "key": "EX",
    "name": "Example",
    "avatarUrls": {
      "48x48": "http://www.example.com/jira/secure/projectavatar?size=large&pid=10000",
      "24x24": "http://www.example.com/jira/secure/projectavatar?size=small&pid=10000",
      "16x16": "http://www.example.com/jira/secure/projectavatar?size=xsmall&pid=10000",
      "32x32": "http://www.example.com/jira/secure/projectavatar?size=medium&pid=10000"
    },
    "projectCategory": {
      "self": "http://www.example.com/jira/rest/api/2/projectCategory/10000",
      "id": "10000",
      "name": "FIRST",
      "description": "First Project Category"
    },
    "simplified": false
  },
  {
    "self": "http://www.example.com/jira/rest/api/2/project/ABC",
    "id": "10001",
    "key": "ABC",
    "name": "Alphabetical",
    "avatarUrls": {
      "48x48": "http://www.example.com/jira/secure/projectavatar?size=large&pid=10001",
      "24x24": "http://www.example.com/jira/secure/projectavatar?size=small&pid=10001",
      "16x16": "http://www.example.com/jira/secure/projectavatar?size=xsmall&pid=10001",
      "32x32": "http://www.example.com/jira/secure/projectavatar?size=medium&pid=10001"
    },
    "projectCategory": {
      "self": "http://www.example.com/jira/rest/api/2/projectCategory/10000",
      "id": "10000",
      "name": "FIRST",
      "description": "First Project Category"
    },
    "simplified": false
  }
]
"""


class MockJiraApiClient(object):
    def get_create_meta(self, project=None):
        return json.loads(SAMPLE_CREATE_META_RESPONSE)

    def get_projects_list(self):
        return json.loads(SAMPLE_PROJECT_LIST_RESPONSE)


class JiraIntegrationTest(APITestCase):
    def test_get_create_issue_config(self):
        org = self.organization
        self.login_as(self.user)
        group = self.create_group()
        self.create_event(group=group)

        integration = Integration.objects.create(
            provider='jira',
            name='Example JIRA',
        )
        integration.add_organization(org.id)

        installation = integration.get_installation()

        def get_client():
            return MockJiraApiClient()

        with mock.patch.object(installation, 'get_client', get_client):
            assert installation.get_create_issue_config(group) == [{
                'default': '10000',
                'choices': [('10000', 'EX'), ('10001', 'ABC')],
                'type': 'select',
                'name': 'project',
                'label': 'Jira Project',
            }, {
                'default': 'message',
                'type': 'string',
                'name': 'title',
                'label': 'Title',
            }, {
                'default': ('%s\n\n```\n'
                            'Stacktrace (most recent call last):\n\n  '
                            'File "sentry/models/foo.py", line 29, in build_msg\n    '
                            'string_max_length=self.string_max_length)\n\nmessage\n```'
                            ) % (absolute_uri(group.get_absolute_url()),),
                'type': 'textarea',
                'name': 'description',
                'label': 'Description',
            }, {
                'default': '1',
                'choices': [('1', 'Bug')],
                'type': 'select',
                'name': 'issuetype',
                'label': 'Issue Type'
            }]


class JiraSearchEndpointTest(APITestCase):
    def test_simple(self):
        org = self.organization
        self.login_as(self.user)
        group = self.create_group()

        integration = Integration.objects.create(
            provider='jira',
            name='Example JIRA',
        )
        integration.add_organization(org.id)

        installation = integration.get_installation()

        assert installation.get_link_issue_config(group) == [
            {
                'name': 'externalIssue',
                'label': 'Issue',
                'default': '',
                'type': 'string',
                'autocompleteUrl': reverse(
                    'sentry-extensions-jira-search', args=[org.slug, integration.id],
                )
            }
        ]
