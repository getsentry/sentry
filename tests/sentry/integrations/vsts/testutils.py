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
