from __future__ import absolute_import

COMPARE_COMMITS_EXAMPLE = b"""
{
  "count": 1,
  "value": [
    {
      "commitId": "6c36052c58bde5e57040ebe6bdb9f6a52c906fff",
      "author": {
        "name": "max bittker",
        "email": "max@sentry.io",
        "date": "2018-04-24T00:03:18Z"
      },
      "committer": {
        "name": "max bittker",
        "email": "max@sentry.io",
        "date": "2018-04-24T00:03:18Z"
      },
      "comment": "Updated README.md",
      "changeCounts": {"Add": 0, "Edit": 1, "Delete": 0},
      "url":
        "https://mbittker.visualstudio.com/_apis/git/repositories/b1e25999-c080-4ea1-8c61-597c4ec41f06/commits/6c36052c58bde5e57040ebe6bdb9f6a52c906fff",
      "remoteUrl":
        "https://mbittker.visualstudio.com/_git/MyFirstProject/commit/6c36052c58bde5e57040ebe6bdb9f6a52c906fff"
    }
  ]
}
"""


FILE_CHANGES_EXAMPLE = b"""
{
  "changeCounts": {"Edit": 1},
  "changes": [
    {
      "item": {
        "objectId": "b48e843656a0a12926a0bcedefe8ef3710fe2867",
        "originalObjectId": "270b590a4edf3f19aa7acc7b57379729e34fc681",
        "gitObjectType": "blob",
        "commitId": "6c36052c58bde5e57040ebe6bdb9f6a52c906fff",
        "path": "/README.md",
        "url":
          "https://mbittker.visualstudio.com/DefaultCollection/_apis/git/repositories/b1e25999-c080-4ea1-8c61-597c4ec41f06/items/README.md?versionType=Commit&version=6c36052c58bde5e57040ebe6bdb9f6a52c906fff"
      },
      "changeType": "edit"
    }
  ]
}
"""
WORK_ITEM_RESPONSE = """{
  "id": 309,
  "rev": 1,
  "fields": {
    "System.AreaPath": "Fabrikam-Fiber-Git",
    "System.TeamProject": "Fabrikam-Fiber-Git",
    "System.IterationPath": "Fabrikam-Fiber-Git",
    "System.WorkItemType": "Product Backlog Item",
    "System.State": "New",
    "System.Reason": "New backlog item",
    "System.CreatedDate": "2015-01-07T18:13:01.807Z",
    "System.CreatedBy": "Jamal Hartnett <fabrikamfiber4@hotmail.com>",
    "System.ChangedDate": "2015-01-07T18:13:01.807Z",
    "System.ChangedBy": "Jamal Hartnett <fabrikamfiber4@hotmail.com>",
    "System.Title": "Hello",
    "Microsoft.VSTS.Scheduling.Effort": 8,
    "WEF_6CB513B6E70E43499D9FC94E5BBFB784_Kanban.Column": "New",
    "System.Description": "Fix this."
  },
  "_links": {
    "self": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workItems/309"
    },
    "workItemUpdates": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workItems/309/updates"
    },
    "workItemRevisions": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workItems/309/revisions"
    },
    "workItemHistory": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workItems/309/history"
    },
    "html": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/web/wi.aspx?pcguid=d81542e4-cdfa-4333-b082-1ae2d6c3ad16&id=309"
    },
    "workItemType": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/workItemTypes/Product%20Backlog%20Item"
    },
    "fields": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/fields"
    }
  },
  "url": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workItems/309"
}"""

GET_USERS_RESPONSE = b"""{
  "count": 4,
  "value": [
    {
      "subjectKind": "user",
      "cuid": "ec09a4d8-d914-4f28-9e39-23d52b683f90",
      "domain": "Build",
      "principalName": "51ac8d19-6694-459f-a65e-bec30e9e2e33",
      "mailAddress": "",
      "origin": "vsts",
      "originId": "ec09a4d8-d914-4f28-9e39-23d52b683f90",
      "displayName": "Project Collection Build Service (Ftottentest2)",
      "_links": {
        "self": {
          "href": "https://fabrikam.vssps.visualstudio.com/_apis/graph/users/TWljcm9zb2Z0LlRlYW1Gb3VuZGF0aW9uLlNlcnZpY2VJZGVudGl0eTtmMzViOTAxNS1jZGU4LTQ4MzQtYTFkNS0wOWU4ZjM1OWNiODU6QnVpbGQ6NTFhYzhkMTktNjY5NC00NTlmLWE2NWUtYmVjMzBlOWUyZTMz"
        },
        "memberships": {
          "href": "https://fabrikam.vssps.visualstudio.com/_apis/graph/memberships/TWljcm9zb2Z0LlRlYW1Gb3VuZGF0aW9uLlNlcnZpY2VJZGVudGl0eTtmMzViOTAxNS1jZGU4LTQ4MzQtYTFkNS0wOWU4ZjM1OWNiODU6QnVpbGQ6NTFhYzhkMTktNjY5NC00NTlmLWE2NWUtYmVjMzBlOWUyZTMz"
        }
      },
      "url": "https://fabrikam.vssps.visualstudio.com/_apis/graph/users/TWljcm9zb2Z0LlRlYW1Gb3VuZGF0aW9uLlNlcnZpY2VJZGVudGl0eTtmMzViOTAxNS1jZGU4LTQ4MzQtYTFkNS0wOWU4ZjM1OWNiODU6QnVpbGQ6NTFhYzhkMTktNjY5NC00NTlmLWE2NWUtYmVjMzBlOWUyZTMz",
      "descriptor": "TWljcm9zb2Z0LlRlYW1Gb3VuZGF0aW9uLlNlcnZpY2VJZGVudGl0eTtmMzViOTAxNS1jZGU4LTQ4MzQtYTFkNS0wOWU4ZjM1OWNiODU6QnVpbGQ6NTFhYzhkMTktNjY5NC00NTlmLWE2NWUtYmVjMzBlOWUyZTMz"
    },
    {
      "subjectKind": "user",
      "metaType": "member",
      "cuid": "00ca946b-2fe9-4f2a-ae2f-40d5c48001bc",
      "domain": "LOCAL AUTHORITY",
      "principalName": "TeamFoundationService (TEAM FOUNDATION)",
      "mailAddress": "",
      "origin": "vsts",
      "originId": "00ca946b-2fe9-4f2a-ae2f-40d5c48001bc",
      "displayName": "TeamFoundationService (TEAM FOUNDATION)",
      "_links": {
        "self": {
          "href": "https://fabrikam.vssps.visualstudio.com/_apis/graph/users/TWljcm9zb2Z0LklkZW50aXR5TW9kZWwuQ2xhaW1zLkNsYWltc0lkZW50aXR5Ozc3ODlmMDlkLWUwNTMtNGYyZS1iZGVlLTBjOGY4NDc2YTRiYw"
        },
        "memberships": {
          "href": "https://fabrikam.vssps.visualstudio.com/_apis/graph/memberships/TWljcm9zb2Z0LklkZW50aXR5TW9kZWwuQ2xhaW1zLkNsYWltc0lkZW50aXR5Ozc3ODlmMDlkLWUwNTMtNGYyZS1iZGVlLTBjOGY4NDc2YTRiYw"
        }
      },
      "url": "https://fabrikam.vssps.visualstudio.com/_apis/graph/users/TWljcm9zb2Z0LklkZW50aXR5TW9kZWwuQ2xhaW1zLkNsYWltc0lkZW50aXR5Ozc3ODlmMDlkLWUwNTMtNGYyZS1iZGVlLTBjOGY4NDc2YTRiYw",
      "descriptor": "TWljcm9zb2Z0LklkZW50aXR5TW9kZWwuQ2xhaW1zLkNsYWltc0lkZW50aXR5Ozc3ODlmMDlkLWUwNTMtNGYyZS1iZGVlLTBjOGY4NDc2YTRiYw"
    },
    {
      "subjectKind": "user",
      "metaType": "member",
      "cuid": "ddd94918-1fc8-459b-994a-cca86c4fbe95",
      "domain": "TEAM FOUNDATION",
      "principalName": "Anonymous",
      "mailAddress": "",
      "origin": "vsts",
      "originId": "ddd94918-1fc8-459b-994a-cca86c4fbe95",
      "displayName": "Anonymous",
      "_links": {
        "self": {
          "href": "https://fabrikam.vssps.visualstudio.com/_apis/graph/users/TWljcm9zb2Z0LlRlYW1Gb3VuZGF0aW9uLlVuYXV0aGVudGljYXRlZElkZW50aXR5O1MtMS0wLTA"
        },
        "memberships": {
          "href": "https://fabrikam.vssps.visualstudio.com/_apis/graph/memberships/TWljcm9zb2Z0LlRlYW1Gb3VuZGF0aW9uLlVuYXV0aGVudGljYXRlZElkZW50aXR5O1MtMS0wLTA"
        }
      },
      "url": "https://fabrikam.vssps.visualstudio.com/_apis/graph/users/TWljcm9zb2Z0LlRlYW1Gb3VuZGF0aW9uLlVuYXV0aGVudGljYXRlZElkZW50aXR5O1MtMS0wLTA",
      "descriptor": "TWljcm9zb2Z0LlRlYW1Gb3VuZGF0aW9uLlVuYXV0aGVudGljYXRlZElkZW50aXR5O1MtMS0wLTA"
    },
    {
      "subjectKind": "user",
      "metaType": "member",
      "cuid": "65903f92-53dc-61b3-bb0e-e69cfa1cb719",
      "domain": "45aa3d2d-7442-473d-b4d3-3c670da9dd96",
      "principalName": "ftotten@vscsi.us",
      "mailAddress": "ftotten@vscsi.us",
      "origin": "aad",
      "originId": "4be8f294-000d-4431-8506-57420b88e204",
      "displayName": "Francis Totten",
      "_links": {
        "self": {
          "href": "https://fabrikam.vssps.visualstudio.com/_apis/graph/users/TWljcm9zb2Z0LklkZW50aXR5TW9kZWwuQ2xhaW1zLkNsYWltc0lkZW50aXR5OzQ1YWEzZDJkLTc0NDItNDczZC1iNGQzLTNjNjcwZGE5ZGQ5NlxmdG90dGVuQHZzY3NpLnVz"
        },
        "memberships": {
          "href": "https://fabrikam.vssps.visualstudio.com/_apis/graph/memberships/TWljcm9zb2Z0LklkZW50aXR5TW9kZWwuQ2xhaW1zLkNsYWltc0lkZW50aXR5OzQ1YWEzZDJkLTc0NDItNDczZC1iNGQzLTNjNjcwZGE5ZGQ5NlxmdG90dGVuQHZzY3NpLnVz"
        }
      },
      "url": "https://fabrikam.vssps.visualstudio.com/_apis/graph/users/TWljcm9zb2Z0LklkZW50aXR5TW9kZWwuQ2xhaW1zLkNsYWltc0lkZW50aXR5OzQ1YWEzZDJkLTc0NDItNDczZC1iNGQzLTNjNjcwZGE5ZGQ5NlxmdG90dGVuQHZzY3NpLnVz",
      "descriptor": "TWljcm9zb2Z0LklkZW50aXR5TW9kZWwuQ2xhaW1zLkNsYWltc0lkZW50aXR5OzQ1YWEzZDJkLTc0NDItNDczZC1iNGQzLTNjNjcwZGE5ZGQ5NlxmdG90dGVuQHZzY3NpLnVz"
    }
  ]
}
"""
CREATE_SUBSCRIPTION = {
    'id': 'fd672255-8b6b-4769-9260-beea83d752ce',
    'url': 'https://fabrikam.visualstudio.com/_apis/hooks/subscriptions/fd672255-8b6b-4769-9260-beea83d752ce',
    'publisherId': 'tfs',
    'eventType': 'workitem.update',
    'resourceVersion': '1.0-preview.1',
    'eventDescription': 'WorkItem Updated',
    'consumerId': 'webHooks',
    'consumerActionId': 'httpRequest',
    'actionDescription': 'To host myservice',
    'createdBy': {
        'id': '00ca946b-2fe9-4f2a-ae2f-40d5c48001bc'
    },
    'createdDate': '2014-10-27T15:37:24.873Z',
    'modifiedBy': {
        'id': '00ca946b-2fe9-4f2a-ae2f-40d5c48001bc'
    },
    'modifiedDate': '2014-10-27T15:37:26.23Z',
    'publisherInputs': {
        'buildStatus': 'Failed',
        'definitionName': 'MyWebSite CI',
        'hostId': 'd81542e4-cdfa-4333-b082-1ae2d6c3ad16',
        'projectId': '6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c',
        'tfsSubscriptionId': '3e8b33e7-426d-4c92-9bf9-58e163dd7dd5'
    },
    'consumerInputs': {
        'url': 'https://myservice/newreceiver'
    }
}

WORK_ITEM_UPDATED = {
    u'resourceContainers': {
        u'project': {u'id': u'c0bf429a-c03c-4a99-9336-d45be74db5a6', u'baseUrl': u'https://laurynsentry.visualstudio.com/'},
        u'account': {u'id': u'90e9a854-eb98-4c56-ae1a-035a0f331dd6', u'baseUrl': u'https://laurynsentry.visualstudio.com/'},
        u'collection': {u'id': u'80ded3e8-3cd3-43b1-9f96-52032624aa3a', u'baseUrl': u'https://laurynsentry.visualstudio.com/'}
    },
    u'resource': {
        u'revisedBy': {
            u'displayName': u'lauryn', u'name': u'lauryn <lauryn@sentry.io>', u'url': u'https://app.vssps.visualstudio.com/A90e9a854-eb98-4c56-ae1a-035a0f331dd6/_apis/Identities/21354f98-ab06-67d9-b974-5a54d992082e', u'imageUrl': u'https://laurynsentry.visualstudio.com/_api/_common/identityImage?id=21354f98-ab06-67d9-b974-5a54d992082e', u'descriptor': u'msa.MjEzNTRmOTgtYWIwNi03N2Q5LWI5NzQtNWE1NGQ5OTIwODJl', u'_links': {u'avatar': {u'href': u'https://laurynsentry.visualstudio.com/_apis/GraphProfile/MemberAvatars/msa.MjEzNTRmOTgtYWIwNi03N2Q5LWI5NzQtNWE1NGQ5OTIwODJl'}},
            u'uniqueName': u'lauryn@sentry.io', u'id': u'21354f98-ab06-67d9-b974-5a54d992082e'
        },
        u'revisedDate': u'9999-01-01T00:00:00Z',
        u'url': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/31/updates/2',
        u'fields': {
            u'System.AuthorizedDate': {u'newValue': u'2018-07-05T20:52:14.777Z', u'oldValue': u'2018-07-05T20:51:58.927Z'},
            u'System.AssignedTo': {u'newValue': u'lauryn <lauryn@sentry.io>', u'oldValue': u'lauryn2 <lauryn2@sentry.io>'},
            u'System.Watermark': {u'newValue': 78, u'oldValue': 77},
            u'System.Rev': {u'newValue': 2, u'oldValue': 1},
            u'System.RevisedDate': {u'newValue': u'9999-01-01T00:00:00Z', u'oldValue': u'2018-07-05T20:52:14.777Z'},
            u'System.ChangedDate': {u'newValue': u'2018-07-05T20:52:14.777Z', u'oldValue': u'2018-07-05T20:51:58.927Z'}
        },
        u'workItemId': 31,
        u'rev': 2,
        u'_links': {
            u'self': {u'href': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/31/updates/2'},
            u'workItemUpdates': {u'href': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/31/updates'},
            u'html': {u'href': u'https://laurynsentry.visualstudio.com/web/wi.aspx?pcguid=80ded3e8-3cd3-43b1-9f96-52032624aa3a&id=31'},
            u'parent': {u'href': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/31'}
        },
        u'id': 2,
        u'revision': {
            u'url': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/31/revisions/2',
            u'fields': {
                u'System.AreaPath': u'MyFirstProject',
                u'System.WorkItemType': u'Bug',
                u'System.Reason': u'New',
                u'System.Title': u"NameError: global name 'BitbucketRepositoryProvider' is not defined",
                u'Microsoft.VSTS.Common.Priority': 2,
                u'System.CreatedBy': u'lauryn <lauryn@sentry.io>',
                u'System.AssignedTo': u'lauryn <lauryn@sentry.io>',
                u'System.CreatedDate': u'2018-07-05T20:51:58.927Z',
                u'System.TeamProject': u'MyFirstProject',
                u'Microsoft.VSTS.Common.Severity': u'3 - Medium',
                u'Microsoft.VSTS.Common.ValueArea': u'Business',
                u'System.State': u'New',
                u'System.Description': u'<p><a href="https://lauryn.ngrok.io/sentry/internal/issues/55/">https://lauryn.ngrok.io/sentry/internal/issues/55/</a></p>\n<pre><code>NameError: global name \'BitbucketRepositoryProvider\' is not defined\n(1 additional frame(s) were not displayed)\n...\n  File &quot;sentry/runner/__init__.py&quot;, line 125, in configure\n    configure(ctx, py, yaml, skip_service_validation)\n  File &quot;sentry/runner/settings.py&quot;, line 152, in configure\n    skip_service_validation=skip_service_validation\n  File &quot;sentry/runner/initializer.py&quot;, line 315, in initialize_app\n    register_plugins(settings)\n  File &quot;sentry/runner/initializer.py&quot;, line 60, in register_plugins\n    integration.setup()\n  File &quot;sentry/integrations/bitbucket/integration.py&quot;, line 78, in setup\n    BitbucketRepositoryProvider,\n\nNameError: global name \'BitbucketRepositoryProvider\' is not defined\n</code></pre>\n',
                u'System.ChangedBy': u'lauryn <lauryn@sentry.io>',
                u'System.ChangedDate': u'2018-07-05T20:52:14.777Z',
                u'Microsoft.VSTS.Common.StateChangeDate': u'2018-07-05T20:51:58.927Z',
                u'System.IterationPath': u'MyFirstProject'},
            u'rev': 2,
            u'id': 31,
            u'_links': {u'self': {u'href': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/31/revisions/2'}, u'workItemRevisions': {u'href': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/31/revisions'}, u'parent': {u'href': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/31'}}
        }
    },
    u'eventType': u'workitem.updated',
    u'detailedMessage': None,
    u'createdDate': u'2018-07-05T20:52:16.3051288Z',
    u'id': u'18f51331-2640-4bce-9ebd-c59c855956a2',
    u'resourceVersion': u'1.0',
    u'notificationId': 1,
    u'subscriptionId': u'7bf628eb-b3a7-4fb2-ab4d-8b60f2e8cb9b',
    u'publisherId': u'tfs',
    u'message': None
}


WORK_ITEM_UNASSIGNED = {
    u'resourceContainers': {
        u'project': {
            u'id': u'c0bf429a-c03c-4a99-9336-d45be74db5a6',
            u'baseUrl': u'https://laurynsentry.visualstudio.com/'
        },
        u'account': {
            u'id': u'90e9a854-eb98-4c56-ae1a-035a0f331dd6',
            u'baseUrl': u'https://laurynsentry.visualstudio.com/'
        },
        u'collection': {
            u'id': u'80ded3e8-3cd3-43b1-9f96-52032624aa3a',
            u'baseUrl': u'https://laurynsentry.visualstudio.com/'
        }
    },
    u'resource': {
        u'revisedBy': {
            u'displayName': u'lauryn',
            u'name': u'lauryn <lauryn@sentry.io>',
            u'url': u'https://app.vssps.visualstudio.com/A90e9a854-eb98-4c56-ae1a-035a0f331dd6/_apis/Identities/21354f98-ab06-67d9-b974-5a54d992082e',
            u'imageUrl': u'https://laurynsentry.visualstudio.com/_api/_common/identityImage?id=21354f98-ab06-67d9-b974-5a54d992082e',
            u'descriptor': u'msa.MjEzNTRmOTgtYWIwNi03N2Q5LWI5NzQtNWE1NGQ5OTIwODJl',
            u'_links': {
                u'avatar': {
                    u'href': u'https://laurynsentry.visualstudio.com/_apis/GraphProfile/MemberAvatars/msa.MjEzNTRmOTgtYWIwNi03N2Q5LWI5NzQtNWE1NGQ5OTIwODJl'
                }
            },
            u'uniqueName': u'lauryn@sentry.io',
            u'id': u'21354f98-ab06-67d9-b974-5a54d992082e'
        },
        u'revisedDate': u'9999-01-01T00:00:00      Z',
        u'url': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/33/updates/3',
        u'fields': {
            u'System.AuthorizedDate': {
                u'newValue': u'2018-07-05T23:23:09.493            Z',
                u'oldValue': u'2018-07-05T23:21:38.243            Z'
            },
            u'System.AssignedTo': {
                u'oldValue': u'lauryn <lauryn@sentry.io>'
            },
            u'System.Watermark': {
                u'newValue': 83,
                u'oldValue': 82
            },
            u'System.Rev': {
                u'newValue': 3,
                u'oldValue': 2
            },
            u'System.RevisedDate': {
                u'newValue': u'9999-01-01T00:00:00            Z',
                u'oldValue': u'2018-07-05T23:23:09.493            Z'
            },
            u'System.ChangedDate': {
                u'newValue': u'2018-07-05T23:23:09.493            Z',
                u'oldValue': u'2018-07-05T23:21:38.243            Z'
            }
        },
        u'workItemId': 33,
        u'rev': 3,
        u'_links': {
            u'self': {
                u'href': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/33/updates/3'
            },
            u'workItemUpdates': {
                u'href': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/33/updates'
            },
            u'html': {
                u'href': u'https://laurynsentry.visualstudio.com/web/wi.aspx?pcguid=80ded3e8-3cd3-43b1-9f96-52032624aa3a&id=33'
            },
            u'parent': {
                u'href': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/33'
            }
        },
        u'id': 3,
        u'revision': {
            u'url': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/33/revisions/3',
            u'fields': {
                u'System.AreaPath': u'MyFirstProject',
                u'System.WorkItemType': u'Bug',
                u'System.Reason': u'New',
                u'System.Title': u'NotImplementedError:Visual Studio Team Services requires an organization_id',
                u'Microsoft.VSTS.Common.Priority': 2,
                u'System.CreatedBy': u'lauryn <lauryn@sentry.io>',
                u'Microsoft.VSTS.Common.StateChangeDate': u'2018-07-05T23:21:25.847            Z',
                u'System.CreatedDate': u'2018-07-05T23:21:25.847            Z',
                u'System.TeamProject': u'MyFirstProject',
                u'Microsoft.VSTS.Common.ValueArea': u'Business',
                u'System.State': u'New',
                u'System.Description': u'<p><a href="https:            //lauryn.ngrok.io/sentry/internal/issues/196/">https:            //lauryn.ngrok.io/sentry/internal/issues/196/</a></p>\n<pre><code>NotImplementedError:Visual Studio Team Services requires an organization_id\n(57 additional frame(s) were not displayed)\n...\n  File &quot;sentry/tasks/base.py&quot;',
                u'System.ChangedBy': u'lauryn <lauryn@sentry.io>',
                u'System.ChangedDate': u'2018-07-05T23:23:09.493            Z',
                u'Microsoft.VSTS.Common.Severity': u'3 - Medium',
                u'System.IterationPath': u'MyFirstProject'
            },
            u'rev': 3,
            u'id': 33,
            u'_links': {
                u'self': {
                    u'href': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/33/revisions/3'
                },
                u'workItemRevisions': {
                    u'href': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/33/revisions'
                },
                u'parent': {
                    u'href': u'https://laurynsentry.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workItems/33'
                }
            }
        }
    },
    u'eventType': u'workitem.updated',
    u'detailedMessage': None,
    u'createdDate': u'2018-07-05T23:23:11.1935112   Z',
    u'id': u'cc349c85-6595-4939-9b69-f89480be6a26',
    u'resourceVersion': u'1.0',
    u'notificationId': 2,
    u'subscriptionId': u'7405a600-6a25-48e6-81b6-1dde044783ad',
    u'publisherId': u'tfs',
    u'message': None
}
