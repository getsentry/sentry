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
                    "name": "Severe issues",
                    "conditions": [
                        {
                            "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                            "name": "A new issue is created",
                        }
                    ],
                    "filters": [
                        {
                            "match": "gte",
                            "id": "sentry.rules.filters.issue_severity.IssueSeverityFilter",
                            "value": "0.05",
                            "name": "The issue's severity is greater than or equal to 0.05",
                        }
                    ],
                    "filterMatch": "all",
                    "actions": [
                        {
                            "workspace": "1",
                            "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                            "channel": "sentry-alerts",
                            "channel_id": "XO23H3M4",
                            "name": "Send a notification to the Plays with Squirrels Slack workspace to sentry-alerts (optionally, an ID: XO23H3M4) and show tags [] in notification",
                        }
                    ],
                    "actionMatch": "any",
                    "createdBy": {"id": 2, "name": "John Doe", "email": "johndoe@email.com"},
                    "dateCreated": "2023-09-08T20:00:07.244602Z",
                    "environment": "prod",
                    "frequency": 300,
                    "owner": "team:24601",
                    "projects": ["squirrels"],
                    "lastTriggered": "2023-09-09T21:00:13.244602Z",
                    "snooze": False,
                    "snoozeCreatedBy": None,
                    "snoozeForEveryone": None,
                    "status": "active",
                }
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    CREATE_ISSUE_ALERT_RULE = [
        OpenApiExample(
            "Issue alert successfully created",
            value={
                "id": "3",
                "name": "Severe issues",
                "conditions": [
                    {
                        "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                        "name": "A new issue is created",
                    }
                ],
                "filters": [
                    {
                        "match": "gte",
                        "id": "sentry.rules.filters.issue_severity.IssueSeverityFilter",
                        "value": "0.05",
                        "name": "The issue's severity is greater than or equal to 0.05",
                    }
                ],
                "filterMatch": "all",
                "actions": [
                    {
                        "workspace": "1",
                        "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                        "channel": "sentry-alerts",
                        "channel_id": "XO23H3M4",
                        "name": "Send a notification to the Plays with Squirrels Slack workspace to sentry-alerts (optionally, an ID: XO23H3M4) and show tags [] in notification",
                    }
                ],
                "actionMatch": "any",
                "createdBy": {"id": 2, "name": "John Doe", "email": "johndoe@email.com"},
                "dateCreated": "2023-09-08T20:00:07.244602Z",
                "environment": "prod",
                "frequency": 300,
                "owner": "team:24601",
                "projects": ["squirrels"],
                "status": "active",
            },
            status_codes=["201"],
            response_only=True,
        )
    ]
