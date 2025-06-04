from typing import Any

"""
Contains data blobs that we store in the Rule.action json field.

These are used to test the workflow engine's migration helpers and Notification Action handlers.

Ideally we move this into a fixture and dynamically generate the data blobs based on the current state of the code.
"""

GITHUB_ACTION_DATA_BLOBS = [
    # Small example
    {
        "integration": "123456",
        "id": "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
        "dynamic_form_fields": [
            {
                "name": "repo",
                "label": "GitHub Repository",
            },
        ],
        "repo": "bufobot/bufo-bot",
        "labels": ["bug", "documentation"],
        "uuid": "12345678-90ab-cdef-0123-456789abcdef",
    },
    # Missing assignee key
    {
        "integration": "123456",
        "id": "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
        "dynamic_form_fields": [
            {
                "name": "repo",
                "label": "GitHub Repository",
                "type": "select",
                "default": "bufobot/bufo-bot",
                "choices": [
                    ["bufobot/bufo-bot", "bufo-bot"],
                    ["bufobot/bufo-bot-2", "bufo-bot-2"],
                    [
                        "bufobot/bufo-bot-3",
                        {
                            "key": "bufobot/bufo-bot-3",
                            "ref": None,
                            "props": {
                                "children": [
                                    {
                                        "key": "bufobot/bufo-bot-3",
                                        "ref": None,
                                        "props": {
                                            "title": {
                                                "key": "bufobot/bufo-bot-3",
                                                "ref": None,
                                                "_owner": None,
                                            },
                                            "size": "xs",
                                        },
                                    },
                                    " ",
                                    "bufo-bot-3",
                                ]
                            },
                            "_owner": None,
                        },
                    ],
                ],
                "url": "/extensions/github/search/bufobot/123456/",
                "updatesForm": True,
                "required": True,
            },
            {
                "name": "assignee",
                "label": "Assignee",
                "default": "",
                "type": "select",
                "required": False,
                "choices": [
                    ["", "Unassigned"],
                    ["bufo-bot", "bufo-bot"],
                    ["bufo-bot-2", "bufo-bot-2"],
                    ["bufo-bot-3", "bufo-bot-3"],
                ],
            },
            {
                "name": "labels",
                "label": "Labels",
                "default": [],
                "type": "select",
                "multiple": True,
                "required": False,
                "choices": [
                    ["bug", "bug"],
                    ["documentation", "documentation"],
                    ["duplicate", "duplicate"],
                    ["enhancement", "enhancement"],
                    ["good first issue", "good first issue"],
                    ["invalid", "invalid"],
                    ["question", "question"],
                    ["security", "security"],
                ],
            },
        ],
        "repo": "bufobot/bufo-bot",
        "labels": ["bug", "documentation"],
        "uuid": "12345678-90ab-cdef-0123-456789abcdef",
    },
    # Complete example
    {
        "integration": "00000",
        "id": "sentry.integrations.github.notify_action.GitHubCreateTicketAction",
        "dynamic_form_fields": [
            {
                "name": "repo",
                "label": "GitHub Repository",
                "type": "select",
                "default": "bufobot/bufo-bot-3",
                "choices": [
                    [
                        "bufobot/bufo-bot-3",
                        "bufo-bot-3",
                    ]
                ],
                "url": "/extensions/github/search/bufobot/00000/",
                "updatesForm": True,
                "required": True,
            },
            {
                "name": "assignee",
                "label": "Assignee",
                "default": "",
                "type": "select",
                "required": False,
                "choices": [["", "Unassigned"], ["bufo-bot", "bufo-bot"]],
            },
            {
                "name": "labels",
                "label": "Labels",
                "default": [],
                "type": "select",
                "multiple": True,
                "required": False,
                "choices": [
                    ["bug", "bug"],
                    ["documentation", "documentation"],
                    ["duplicate", "duplicate"],
                    ["enhancement", "enhancement"],
                    ["good first issue", "good first issue"],
                    ["help wanted", "help wanted"],
                    ["invalid", "invalid"],
                    ["question", "question"],
                    ["wontfix", "wontfix"],
                ],
            },
        ],
        "repo": "bufobot/bufo-bot-3",
        "assignee": "bufo-bot-3",
        "labels": ["bug", "documentation"],
        "uuid": "12345678-90ab-cdef-0123-456789abcdef",
    },
    # Assignee is empty string
    {
        "integration": "22222",
        "id": "sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction",
        "dynamic_form_fields": [
            {
                "name": "repo",
                "label": "GitHub Repository",
                "type": "select",
                "default": "bufobot/bufo-bot-3",
                "choices": [
                    ["bufobot/bufo-bot-3", "bufo-bot-3"],
                    [
                        "bufobot/bufo-bot-3",
                        {
                            "key": "bufobot/bufo-bot-3",
                            "ref": None,
                            "props": {
                                "children": [
                                    {
                                        "key": "bufobot/bufo-bot-3",
                                        "ref": None,
                                        "props": {
                                            "title": {
                                                "key": "bufobot/bufo-bot-3",
                                                "ref": None,
                                                "props": {
                                                    "children": {
                                                        "key": "5",
                                                        "ref": None,
                                                        "_owner": None,
                                                    }
                                                },
                                                "_owner": None,
                                            },
                                            "size": "xs",
                                        },
                                        "_owner": None,
                                    },
                                    " ",
                                    "Project_topup",
                                ]
                            },
                            "_owner": None,
                        },
                    ],
                ],
                "url": "/extensions/github/search/bufobot/22222/",
                "updatesForm": True,
                "required": True,
            },
            {
                "name": "assignee",
                "label": "Assignee",
                "default": "",
                "type": "select",
                "required": False,
                "choices": [
                    ["", "Unassigned"],
                    ["bufo-bot", "bufo-bot"],
                    ["bufo-bot-2", "bufo-bot-2"],
                    ["bufo-bot-3", "bufo-bot-3"],
                ],
            },
            {
                "name": "labels",
                "label": "Labels",
                "default": [],
                "type": "select",
                "multiple": True,
                "required": False,
                "choices": [
                    ["bug", "bug"],
                    ["documentation", "documentation"],
                    ["duplicate", "duplicate"],
                    ["enhancement", "enhancement"],
                    ["good first issue", "good first issue"],
                    ["help wanted", "help wanted"],
                    ["invalid", "invalid"],
                    ["question", "question"],
                ],
            },
        ],
        "repo": "bufobot/bufo-bot-3",
        "assignee": "",
        "labels": [],
        "uuid": "12345678-90ab-cdef-0123-456789abcdef",
    },
]

AZURE_DEVOPS_ACTION_DATA_BLOBS = [
    # Complete example
    {
        "integration": "999999",
        "id": "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
        "dynamic_form_fields": [
            {
                "name": "project",
                "required": True,
                "type": "choice",
                "choices": [
                    ["12345678-90ab-cdef-0123-456789abcdef", "Test Octo"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "Octopus"],
                ],
                "defaultValue": "12345678-90ab-cdef-0123-456789abcdef",
                "label": "Project",
                "placeholder": "12345678-90ab-cdef-0123-456789abcdef",
                "updatesForm": True,
            },
            {
                "name": "work_item_type",
                "required": True,
                "type": "choice",
                "choices": [
                    ["Microsoft.VSTS.WorkItemTypes.Bug", "Bug"],
                    ["Microsoft.VSTS.WorkItemTypes.Epic", "Epic"],
                    ["Microsoft.VSTS.WorkItemTypes.Feature", "Feature"],
                    ["Microsoft.VSTS.WorkItemTypes.UserStory", "User Story"],
                    ["Microsoft.VSTS.WorkItemTypes.TestCase", "Test Case"],
                    ["Microsoft.VSTS.WorkItemTypes.SharedStep", "Shared Steps"],
                    ["Microsoft.VSTS.WorkItemTypes.SharedParameter", "Shared Parameter"],
                    [
                        "Microsoft.VSTS.WorkItemTypes.CodeReviewRequest",
                        "Code Review Request",
                    ],
                    [
                        "Microsoft.VSTS.WorkItemTypes.CodeReviewResponse",
                        "Code Review Response",
                    ],
                    ["Microsoft.VSTS.WorkItemTypes.FeedbackRequest", "Feedback Request"],
                    ["Microsoft.VSTS.WorkItemTypes.FeedbackResponse", "Feedback Response"],
                    ["Microsoft.VSTS.WorkItemTypes.TestPlan", "Test Plan"],
                    ["Microsoft.VSTS.WorkItemTypes.TestSuite", "Test Suite"],
                    ["Microsoft.VSTS.WorkItemTypes.Task", "Task"],
                ],
                "defaultValue": "Microsoft.VSTS.WorkItemTypes.Bug",
                "label": "Work Item Type",
                "placeholder": "Bug",
            },
        ],
        "project": "12345678-90ab-cdef-0123-456789abcdef",
        "work_item_type": "Microsoft.VSTS.WorkItemTypes.Bug",
        "uuid": "7a48abdb-60d7-4d1c-ab00-0eedb2189933",
    },
    # Missing project key
    {
        "integration": "123456",
        "id": "sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction",
        "dynamic_form_fields": [
            {
                "name": "project",
                "required": True,
                "type": "choice",
                "choices": [
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-125"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-121"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-122"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-127"],
                    ["99999999-90ab-cdef-0123-456789abcdef", "O-129"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-131"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-128"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-107"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-120"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-123"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-119"],
                    ["cb72f217-bcb2-495c-b7ad-d6883e696990", "O-116"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-115"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-126"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-102"],
                    ["23ff99ca-92f2-492f-b8a1-d13ed66c465c", "O-124"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-114"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-112"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-108"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-000"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-101"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-104"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-110"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-111"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-130"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-117"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-118"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-109"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-106"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-103"],
                    ["12345678-90ab-cdef-0123-456789abcdef", "O-105"],
                ],
                "defaultValue": "12345678-90ab-cdef-0123-456789abcdef",
                "label": "Project",
                "placeholder": "12345678-90ab-cdef-0123-456789abcdef",
                "updatesForm": True,
            },
            {
                "name": "work_item_type",
                "required": True,
                "type": "choice",
                "choices": [
                    ["Microsoft.VSTS.WorkItemTypes.Bug", "Bug"],
                    ["Microsoft.VSTS.WorkItemTypes.Epic", "Epic"],
                    ["Microsoft.VSTS.WorkItemTypes.Feature", "Feature"],
                    [
                        "Microsoft.VSTS.WorkItemTypes.ProductBacklogItem",
                        "Product Backlog Item",
                    ],
                    ["Microsoft.VSTS.WorkItemTypes.TestCase", "Test Case"],
                    ["Microsoft.VSTS.WorkItemTypes.SharedStep", "Shared Steps"],
                    ["Microsoft.VSTS.WorkItemTypes.SharedParameter", "Shared Parameter"],
                    [
                        "Microsoft.VSTS.WorkItemTypes.CodeReviewRequest",
                        "Code Review Request",
                    ],
                    [
                        "Microsoft.VSTS.WorkItemTypes.CodeReviewResponse",
                        "Code Review Response",
                    ],
                    ["Microsoft.VSTS.WorkItemTypes.FeedbackRequest", "Feedback Request"],
                    ["Microsoft.VSTS.WorkItemTypes.FeedbackResponse", "Feedback Response"],
                    ["Microsoft.VSTS.WorkItemTypes.TestPlan", "Test Plan"],
                    ["Microsoft.VSTS.WorkItemTypes.TestSuite", "Test Suite"],
                    ["Microsoft.VSTS.WorkItemTypes.Task", "Task"],
                ],
                "defaultValue": "Microsoft.VSTS.WorkItemTypes.Bug",
                "label": "Work Item Type",
                "placeholder": "Bug",
            },
        ],
        "work_item_type": "Microsoft.VSTS.WorkItemTypes.Bug",
        "uuid": "4d42b17d-911d-4085-be7f-cc5f32d66371",
    },
]

JIRA_ACTION_DATA_BLOBS = [
    # Small example
    {
        "integration": "12345",
        "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
        "dynamic_form_fields": [
            {
                "name": "project",
                "label": "Jira Project",
                "choices": [["10001", "PROJ1"], ["10002", "PROJ2"], ["10003", "PROJ3"]],
                "default": "10001",
                "type": "select",
                "updatesForm": True,
            },
            {
                "name": "issuetype",
                "label": "Issue Type",
                "default": "10001",
                "type": "select",
                "choices": [["10001", "Story"], ["10002", "Bug"], ["10003", "Task"]],
                "updatesForm": True,
                "required": True,
            },
            {
                "label": "Fix versions",
                "required": False,
                "multiple": True,
                "choices": [],
                "default": "",
                "type": "select",
                "name": "fixVersions",
            },
            {
                "label": "Assignee",
                "required": False,
                "url": "/extensions/jira/search/example/12345/",
                "choices": [["user123", "John Doe"]],
                "type": "select",
                "name": "assignee",
            },
        ],
        "description": "This will be generated from the Sentry Issue details.",
        "project": "10001",
        "issuetype": "10001",
        "assignee": "user123",
        "reporter": "user123",
        "parent": "PROJ-123",
        "labels": "Sentry",
        "uuid": "11111111-1111-1111-1111-111111111111",
    },
    # Custom fields
    {
        "integration": "12345",
        "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
        "dynamic_form_fields": [
            {
                "name": "project",
                "label": "Jira Project",
                "choices": [["10001", "PROJ1"], ["10002", "PROJ2"], ["10003", "PROJ3"]],
                "default": "10001",
                "type": "select",
                "updatesForm": True,
            },
            {
                "name": "issuetype",
                "label": "Issue Type",
                "default": "10001",
                "type": "select",
                "choices": [["10001", "Task"], ["10002", "Bug"], ["10003", "Story"]],
                "updatesForm": True,
                "required": True,
            },
            {
                "label": "Priority",
                "required": False,
                "choices": [
                    ["1", "Highest"],
                    ["2", "High"],
                    ["3", "Medium"],
                    ["4", "Low"],
                    ["5", "Lowest"],
                ],
                "type": "select",
                "name": "priority",
                "default": "",
            },
            {
                "label": "Team",
                "required": False,
                "choices": [
                    ["Team A", "Team A"],
                    ["Team B", "Team B"],
                    ["Team C", "Team C"],
                ],
                "type": "select",
                "name": "customfield_10253",
            },
            {
                "label": "Platform",
                "required": False,
                "multiple": True,
                "choices": [
                    ["iOS", "iOS"],
                    ["Android", "Android"],
                    ["Backend", "Backend"],
                    ["Frontend", "Frontend"],
                ],
                "default": "",
                "type": "select",
                "name": "customfield_10285",
            },
        ],
        "description": "This will be generated from the Sentry Issue details.",
        "project": "10001",
        "issuetype": "10001",
        "priority": "",
        "labels": "",
        "reporter": "user123",
        "customfield_10253": "Team A",
        "customfield_10285": ["Backend"],
        "customfield_10290": "",
        "customfield_10301": "",
        "customfield_10315": "",
        "versions": "",
        "uuid": "12345678-1234-5678-1234-567812345678",
    },
    # Missing keys
    {
        "integration": "123456",
        "id": "sentry.integrations.jira.notify_action.JiraCreateTicketAction",
        "dynamic_form_fields": [
            {
                "name": "project",
                "label": "Jira Project",
                "choices": [["10000", "PROJ1"], ["10003", "PROJ2"]],
                "default": "10000",
                "type": "select",
                "updatesForm": True,
            },
            {
                "name": "issuetype",
                "label": "Issue Type",
                "default": "10031",
                "type": "select",
                "choices": [
                    ["10001", "Task"],
                    ["10002", "Epic"],
                    ["10003", "Subtask"],
                    ["10005", "Question"],
                    ["10018", "Wireframe"],
                    ["10028", "Folder"],
                    ["10029", "Story"],
                    ["10031", "Bug"],
                ],
                "updatesForm": True,
                "required": True,
            },
            {
                "label": "Assignee",
                "required": False,
                "url": "/extensions/jira/search/organization/123456/",
                "choices": [],
                "type": "select",
                "name": "assignee",
            },
            {
                "label": "Development",
                "required": False,
                "type": "text",
                "name": "customfield_10000",
            },
            {
                "label": "Team",
                "required": False,
                "type": "text",
                "name": "customfield_10001",
            },
            {
                "label": "Story point estimate",
                "required": False,
                "type": "text",
                "name": "customfield_10016",
            },
            {
                "label": "Rank",
                "required": False,
                "type": "text",
                "name": "customfield_10019",
            },
            {
                "label": "Flagged",
                "required": False,
                "multiple": True,
                "choices": [["Impediment", "Impediment"]],
                "default": "",
                "type": "select",
                "name": "customfield_10021",
            },
            {
                "label": "Design",
                "required": False,
                "multiple": True,
                "choices": [],
                "default": "",
                "type": "select",
                "name": "customfield_10036",
            },
            {
                "label": "Description",
                "required": False,
                "type": "text",
                "name": "description",
            },
            {
                "label": "Restrict to",
                "required": False,
                "type": "text",
                "name": "issuerestriction",
            },
            {
                "label": "Labels",
                "required": False,
                "type": "text",
                "name": "labels",
                "default": "",
            },
            {
                "label": "Parent",
                "required": False,
                "url": "/extensions/jira/search/organization/123456/",
                "choices": [],
                "type": "select",
                "name": "parent",
            },
            {
                "label": "Reporter",
                "required": True,
                "url": "/extensions/jira/search/organization/123456/",
                "choices": [["user123", "Test User"]],
                "type": "select",
                "name": "reporter",
            },
        ],
        "description": "This will be generated from the Sentry Issue details.",
        "project": "10000",
        "issuetype": "10031",
        "reporter": "user123",
        "uuid": "00000000-0000-0000-0000-000000000000",
    },
]

JIRA_SERVER_ACTION_DATA_BLOBS = [
    # Complete example
    {
        "integration": "123456",
        "id": "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
        "dynamic_form_fields": [
            {
                "name": "project",
                "label": "Jira Project",
                "choices": [["10001", "PROJ1"], ["10002", "PROJ2"], ["10003", "PROJ3"]],
                "default": "10001",
                "type": "select",
                "updatesForm": True,
            },
            {
                "name": "issuetype",
                "label": "Issue Type",
                "default": "1",
                "type": "select",
                "choices": [["1", "Defect"], ["3", "Task"], ["7", "Epic"], ["8", "Story"]],
                "updatesForm": True,
                "required": True,
            },
            {
                "label": "Priority",
                "required": False,
                "choices": [["2", "Blocker"], ["3", "High"], ["6", "Medium"], ["4", "Low"]],
                "type": "select",
                "name": "priority",
                "default": "",
            },
            {
                "label": "Fix Version/s",
                "required": False,
                "multiple": True,
                "choices": [
                    ["81527", "Version 1.0"],
                    ["81529", "Version 1.1"],
                    ["82011", "Version 2.0"],
                ],
                "default": "",
                "type": "select",
                "name": "fixVersions",
            },
            {
                "label": "Component/s",
                "required": False,
                "multiple": True,
                "choices": [
                    ["11841", "Backend"],
                    ["12385", "Frontend"],
                    ["12422", "Mobile"],
                ],
                "default": "",
                "type": "select",
                "name": "components",
            },
            {
                "label": "Description",
                "required": True,
                "type": "text",
                "name": "description",
            },
            {
                "label": "Labels",
                "required": False,
                "type": "text",
                "name": "labels",
                "default": "",
            },
            {
                "label": "Reporter",
                "required": True,
                "url": "/extensions/jira-server/search/org/123456/",
                "choices": [["user123", "Test User"]],
                "type": "select",
                "name": "reporter",
            },
        ],
        "description": "This will be generated from the Sentry Issue details.",
        "project": "10001",
        "issuetype": "1",
        "priority": "3",
        "components": ["11841"],
        "reporter": "user123",
        "uuid": "11111111-1111-1111-1111-111111111111",
    },
    # Missing keys
    {
        "integration": "123456",
        "id": "sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction",
        "dynamic_form_fields": [
            {
                "name": "project",
                "label": "Jira Project",
                "choices": [["20001", "TEAM1"], ["20002", "TEAM2"]],
                "default": "20001",
                "type": "select",
                "updatesForm": True,
            },
            {
                "name": "issuetype",
                "label": "Issue Type",
                "default": "8",
                "type": "select",
                "choices": [["1", "Defect"], ["8", "Story"]],
                "updatesForm": True,
                "required": True,
            },
        ],
        "description": "This will be generated from the Sentry Issue details.",
        "project": "20001",
        "issuetype": "8",
        "reporter": "user123",
        "uuid": "22222222-2222-2222-2222-222222222222",
    },
]

EMAIL_ACTION_DATA_BLOBS: list[dict[str, Any]] = [
    # IssueOwners (targetIdentifier is "None")
    {
        "targetType": "IssueOwners",
        "id": "sentry.mail.actions.NotifyEmailAction",
        "targetIdentifier": "None",
        "fallthroughType": "ActiveMembers",
        "uuid": "2e8847d7-8fe4-44d2-8a16-e25040329790",
    },
    # NoOne Fallthrough (targetIdentifier is "")
    {
        "targetType": "IssueOwners",
        "targetIdentifier": "",
        "id": "sentry.mail.actions.NotifyEmailAction",
        "fallthroughType": "NoOne",
        "uuid": "fb039430-0848-4fc4-89b4-bc7689a9f851",
    },
    # AllMembers Fallthrough (targetIdentifier is None)
    {
        "targetType": "IssueOwners",
        "id": "sentry.mail.actions.NotifyEmailAction",
        "targetIdentifier": None,
        "fallthroughType": "AllMembers",
        "uuid": "41f13756-8f90-4afe-b162-55268c6e3cdb",
    },
    # NoOne Fallthrough (targetIdentifier is "None")
    {
        "targetType": "IssueOwners",
        "id": "sentry.mail.actions.NotifyEmailAction",
        "targetIdentifier": "None",
        "fallthroughType": "NoOne",
        "uuid": "99c9b517-0a0f-47f0-b3ff-2a9cd2fd9c49",
    },
    # ActiveMembers Fallthrough
    {
        "targetType": "Member",
        "fallthroughType": "ActiveMembers",
        "id": "sentry.mail.actions.NotifyEmailAction",
        "targetIdentifier": 3234013,
        "uuid": "6e83337b-9561-4167-a208-27d6bdf5e613",
    },
    # Member Email
    {
        "id": "sentry.mail.actions.NotifyEmailAction",
        "targetIdentifier": 2160509,
        "targetType": "Member",
        "uuid": "42c3e1d6-4004-4a51-a90b-13d3404f1e55",
    },
    # Team Email
    {
        "targetType": "Team",
        "id": "sentry.mail.actions.NotifyEmailAction",
        "fallthroughType": "AllMembers",
        "uuid": "71b445cf-573b-4e0c-86bc-8dfbad93c480",
        "targetIdentifier": 188022,
    },
]

WEBHOOK_ACTION_DATA_BLOBS: list[dict[str, Any]] = [
    {
        "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
        "service": "bufo-bot-integration-1f946b",
        "uuid": "02babf2f-d767-483c-bb5d-0eaae85c532a",
    },
    {
        "service": "opsgenie",
        "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
        "uuid": "02b91e1d-a91c-4357-8190-a08c9e8c15c4",
    },
    {
        "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
        "service": "slack",
        "uuid": "45a8b34b-325d-4efa-b5a1-0c6effc4eba1",
    },
    {
        "service": "webhooks",
        "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
        "uuid": "722decb0-bad9-4f5e-ad06-865439169289",
    },
    {
        "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
        "service": "slack",
        "uuid": "c19cdf39-8110-43fc-ad15-12b372332ac0",
    },
    {
        "service": "chat-erwiuyhrwejkh",
        "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
        "uuid": "add56da2-be45-4182-800e-6b1b7fc4d012",
    },
]
