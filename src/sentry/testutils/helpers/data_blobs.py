"""
Contains data blobs that we store in the Rule.action json field.

These are used to test the workflow engine's migration helpers and Notification Action handlers.

Ideally we move this into a fixture and dynamically generate the data blobs based on the current state of the code.
"""

GITHUB_ACTION_DATA_BLOBS = [
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
