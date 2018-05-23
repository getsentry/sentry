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

SAMPLE_GET_ISSUE_RESPONSE = """
{
  "id": "10002",
  "self": "http://www.example.com/jira/rest/api/2/issue/10002",
  "key": "EX-1",
  "fields": {
    "watcher": {
      "self": "http://www.example.com/jira/rest/api/2/issue/EX-1/watchers",
      "isWatching": false,
      "watchCount": 1,
      "watchers": [
        {
          "self": "http://www.example.com/jira/rest/api/2/user?username=fred",
          "name": "fred",
          "displayName": "Fred F. User",
          "active": false
        }
      ]
    },
    "attachment": [
      {
        "id": 10001,
        "self": "http://www.example.com/jira/rest/api/2.0/attachments/10000",
        "filename": "picture.jpg",
        "author": {
          "self": "http://www.example.com/jira/rest/api/2/user?username=fred",
          "key": "fred",
          "accountId": "99:27935d01-92a7-4687-8272-a9b8d3b2ae2e",
          "name": "fred",
          "avatarUrls": {
            "48x48": "http://www.example.com/jira/secure/useravatar?size=large&ownerId=fred",
            "24x24": "http://www.example.com/jira/secure/useravatar?size=small&ownerId=fred",
            "16x16": "http://www.example.com/jira/secure/useravatar?size=xsmall&ownerId=fred",
            "32x32": "http://www.example.com/jira/secure/useravatar?size=medium&ownerId=fred"
          },
          "displayName": "Fred F. User",
          "active": false
        },
        "created": "2018-05-19T01:17:45.901+0000",
        "size": 23123,
        "mimeType": "image/jpeg",
        "content": "http://www.example.com/jira/attachments/10000",
        "thumbnail": "http://www.example.com/jira/secure/thumbnail/10000"
      }
    ],
    "sub-tasks": [
      {
        "id": "10000",
        "type": {
          "id": "10000",
          "name": "",
          "inward": "Parent",
          "outward": "Sub-task"
        },
        "outwardIssue": {
          "id": "10003",
          "key": "EX-2",
          "self": "http://www.example.com/jira/rest/api/2/issue/EX-2",
          "fields": {
            "status": {
              "iconUrl": "http://www.example.com/jira//images/icons/statuses/open.png",
              "name": "Open"
            }
          }
        }
      }
    ],
    "description": "example bug report",
    "summary": "example summary",
    "project": {
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
    "comment": [
      {
        "self": "http://www.example.com/jira/rest/api/2/issue/10010/comment/10000",
        "id": "10000",
        "author": {
          "self": "http://www.example.com/jira/rest/api/2/user?username=fred",
          "name": "fred",
          "displayName": "Fred F. User",
          "active": false
        },
        "body": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque eget venenatis elit. Duis eu justo eget augue iaculis fermentum. Sed semper quam laoreet nisi egestas at posuere augue semper.",
        "updateAuthor": {
          "self": "http://www.example.com/jira/rest/api/2/user?username=fred",
          "name": "fred",
          "displayName": "Fred F. User",
          "active": false
        },
        "created": "2018-05-19T01:17:45.902+0000",
        "updated": "2018-05-19T01:17:45.902+0000",
        "visibility": {
          "type": "role",
          "value": "Administrators"
        }
      }
    ],
    "issuelinks": [
      {
        "id": "10001",
        "type": {
          "id": "10000",
          "name": "Dependent",
          "inward": "depends on",
          "outward": "is depended by"
        },
        "outwardIssue": {
          "id": "10004L",
          "key": "PRJ-2",
          "self": "http://www.example.com/jira/rest/api/2/issue/PRJ-2",
          "fields": {
            "status": {
              "iconUrl": "http://www.example.com/jira//images/icons/statuses/open.png",
              "name": "Open"
            }
          }
        }
      },
      {
        "id": "10002",
        "type": {
          "id": "10000",
          "name": "Dependent",
          "inward": "depends on",
          "outward": "is depended by"
        },
        "inwardIssue": {
          "id": "10004",
          "key": "PRJ-3",
          "self": "http://www.example.com/jira/rest/api/2/issue/PRJ-3",
          "fields": {
            "status": {
              "iconUrl": "http://www.example.com/jira//images/icons/statuses/open.png",
              "name": "Open"
            }
          }
        }
      }
    ],
    "worklog": [
      {
        "self": "http://www.example.com/jira/rest/api/2/issue/10010/worklog/10000",
        "author": {
          "self": "http://www.example.com/jira/rest/api/2/user?username=fred",
          "name": "fred",
          "displayName": "Fred F. User",
          "active": false
        },
        "updateAuthor": {
          "self": "http://www.example.com/jira/rest/api/2/user?username=fred",
          "name": "fred",
          "displayName": "Fred F. User",
          "active": false
        },
        "comment": "I did some work here.",
        "updated": "2018-05-19T01:17:45.905+0000",
        "visibility": {
          "type": "group",
          "value": "jira-developers"
        },
        "started": "2018-05-19T01:17:45.905+0000",
        "timeSpent": "3h 20m",
        "timeSpentSeconds": 12000,
        "id": "100028",
        "issueId": "10002"
      }
    ],
    "updated": 1,
    "timetracking": {
      "originalEstimate": "10m",
      "remainingEstimate": "3m",
      "timeSpent": "6m",
      "originalEstimateSeconds": 600,
      "remainingEstimateSeconds": 200,
      "timeSpentSeconds": 400
    }
  }
}
"""


class MockJiraApiClient(object):
    def get_create_meta(self, project=None):
        return json.loads(SAMPLE_CREATE_META_RESPONSE)

    def get_create_meta_for_project(self, project):
        return self.get_create_meta()['projects'][0]

    def get_projects_list(self):
        return json.loads(SAMPLE_PROJECT_LIST_RESPONSE)

    def get_issue(self, issue_key):
        return json.loads(SAMPLE_GET_ISSUE_RESPONSE)

    def create_issue(self, data):
        return {'key': 'APP-123'}


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

    def test_get_link_issue_config(self):
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

    def test_create_issue(self):
        org = self.organization
        self.login_as(self.user)

        integration = Integration.objects.create(
            provider='jira',
            name='Example JIRA',
        )
        integration.add_organization(org.id)

        installation = integration.get_installation()

        def get_client():
            return MockJiraApiClient()

        with mock.patch.object(installation, 'get_client', get_client):
            assert installation.create_issue({
                'title': 'example summary',
                'description': 'example bug report',
                'issuetype': '1',
                'project': '10000',
            }) == {
                'title': 'example summary',
                'description': 'example bug report',
                'key': 'APP-123'
            }
