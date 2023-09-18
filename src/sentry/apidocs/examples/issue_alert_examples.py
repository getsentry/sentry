from drf_spectacular.utils import OpenApiExample


class IssueAlertExamples:
    GENERIC_SUCCESS_RESPONSE = [
        OpenApiExample(
            "Successful response",
            value={},
            status_codes=["200"],
            response_only=True,
        )
    ]

    LIST_PROJECT_RULES = [
        OpenApiExample(
            "List issue alert rules for a project",
            value=[
                {
                    "id": "3",
                    "name": "High Number of Issues with Production",
                    "conditions": [
                        {
                            "interval": "1h",
                            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                            "value": 1000,
                            "comparisonType": "count",
                            "name": "The issue is seen more than 1000 times in 1h",
                        }
                    ],
                    "filters": [
                        {
                            "value": "1",
                            "id": "sentry.rules.filters.issue_category.IssueCategoryFilter",
                            "name": "The issue's category is equal to 1",
                        },
                        {
                            "value": "2",
                            "id": "sentry.rules.filters.issue_category.IssueCategoryFilter",
                            "name": "The issue's category is equal to 2",
                        },
                    ],
                    "filterMatch": "any",
                    "actions": [
                        {
                            "targetType": "Team",
                            "fallthroughType": "ActiveMembers",
                            "id": "sentry.mail.actions.NotifyEmailAction",
                            "targetIdentifier": 4367234414355,
                            "name": "Send a notification to Team and if none can be found then send a notification to ActiveMembers",
                        }
                    ],
                    "actionMatch": "any",
                    "createdBy": {"id": 2435786, "name": "Kitty White", "email": "meow@test.io"},
                    "dateCreated": "2023-01-15T06:45:34.353346Z",
                    "environment": "prod",
                    "frequency": 60,
                    "owner": "team:63562",
                    "projects": ["melody"],
                    "lastTriggered": "2023-07-15T00:00:00.351236Z",
                    "snooze": False,
                    "snoozeCreatedBy": None,
                    "snoozeForEveryone": None,
                    "status": "active",
                },
                {
                    "id": "6",
                    "name": "Escalating from Archived",
                    "conditions": [
                        {
                            "id": "sentry.rules.conditions.reappeared_event.ReappearedEventCondition",
                            "name": "The issue changes state from ignored to unresolved",
                        }
                    ],
                    "filters": [],
                    "filterMatch": "all",
                    "actions": [
                        {
                            "targetType": "IssueOwners",
                            "fallthroughType": "AllMembers",
                            "id": "sentry.mail.actions.NotifyEmailAction",
                            "targetIdentifier": "",
                            "name": "Send a notification to IssueOwners and if none can be found then send a notification to AllMembers",
                        }
                    ],
                    "actionMatch": "any",
                    "createdBy": {"id": 2435, "name": "John Doe", "email": "johndoe@email.com"},
                    "dateCreated": "2022-09-18T23:27:02.253030Z",
                    "environment": None,
                    "frequency": 180,
                    "owner": "team:63457",
                    "projects": ["squirrels"],
                    "lastTriggered": "2023-07-15T00:00:00.351236Z",
                    "snooze": False,
                    "snoozeCreatedBy": None,
                    "snoozeForEveryone": None,
                    "status": "active",
                },
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    CREATE_ISSUE_ALERT_RULE = [
        OpenApiExample(
            "Issue alert successfully created",
            value={
                "id": "1",
                "name": "Owner Alert",
                "conditions": [
                    {
                        "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                        "name": "A new issue is created",
                    }
                ],
                "filters": [
                    {
                        "targetType": "Unassigned",
                        "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
                        "targetIdentifier": "",
                        "name": "The issue is assigned to Unassigned",
                    }
                ],
                "filterMatch": "all",
                "actions": [
                    {
                        "targetType": "Member",
                        "fallthroughType": "ActiveMembers",
                        "id": "sentry.mail.actions.NotifyEmailAction",
                        "targetIdentifier": 1523125,
                        "name": "Send a notification to Member and if none can be found then send a notification to ActiveMembers",
                    }
                ],
                "actionMatch": "any",
                "createdBy": {"id": 24601, "name": "Jean Valjean", "email": "jean@test.io"},
                "dateCreated": "2023-09-08T20:00:07.244602Z",
                "environment": None,
                "frequency": 1440,
                "owner": "team:74234",
                "projects": ["python"],
                "lastTriggered": None,
                "snooze": False,
                "snoozeCreatedBy": None,
                "snoozeForEveryone": None,
                "status": "active",
            },
            status_codes=["201"],
            response_only=True,
        )
    ]
