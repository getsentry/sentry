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

    GET_PROJECT_RULE = [
        OpenApiExample(
            "Get detailed view about an issue alert rule",
            value={
                "id": "7",
                "conditions": [
                    {
                        "id": "sentry.rules.conditions.regression_event.RegressionEventCondition",
                    }
                ],
                "filters": [
                    {
                        "id": "sentry.rules.filters.age_comparison.AgeComparisonFilter",
                        "comparison_type": "older",
                        "value": 4,
                        "time": "week",
                    },
                    {
                        "id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter",
                        "value": 1000,
                    },
                ],
                "actions": [
                    {
                        "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                        "workspace": 976462356,
                        "channel": "#fatal",
                        "tags": "browser,release",
                    }
                ],
                "actionMatch": "all",
                "filterMatch": "all",
                "frequency": 60,
                "name": "Many Old Regressions!",
                "dateCreated": "2023-02-17T18:31:14.246012Z",
                "owner": "user:635623",
                "createdBy": {"id": 635623, "name": "John Doe", "email": "john.doe@email.com"},
                "environment": None,
                "projects": ["javascript"],
                "status": "active",
                "snooze": False,
            },
            status_codes=["200"],
            response_only=True,
        )
    ]

    UPDATE_PROJECT_RULE = [
        OpenApiExample(
            "Get detailed view about an issue alert rule",
            value={
                "id": "7",
                "conditions": [
                    {
                        "id": "sentry.rules.conditions.regression_event.RegressionEventCondition",
                    }
                ],
                "filters": [
                    {
                        "id": "sentry.rules.filters.age_comparison.AgeComparisonFilter",
                        "comparison_type": "older",
                        "value": 4,
                        "time": "week",
                    },
                    {
                        "id": "sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter",
                        "value": 1000,
                    },
                    {"id": "sentry.rules.filters.level.LevelFilter", "match": "gte", "level": "40"},
                ],
                "actions": [
                    {
                        "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                        "workspace": 976462356,
                        "channel": "#fatal",
                        "tags": "browser,release",
                    }
                ],
                "actionMatch": "all",
                "filterMatch": "all",
                "frequency": 60,
                "name": "Many Old Regressions!",
                "dateCreated": "2023-02-17T18:31:14.246012Z",
                "owner": "user:635623",
                "createdBy": {"id": 635623, "name": "John Doe", "email": "john.doe@email.com"},
                "environment": None,
                "projects": ["javascript"],
                "status": "active",
                "snooze": False,
            },
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
                    "conditions": [
                        {
                            "interval": "1h",
                            "id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
                            "value": 1000,
                        }
                    ],
                    "filters": [
                        {
                            "value": "1",
                            "id": "sentry.rules.filters.issue_category.IssueCategoryFilter",
                        },
                        {
                            "value": "2",
                            "id": "sentry.rules.filters.issue_category.IssueCategoryFilter",
                        },
                    ],
                    "actions": [
                        {
                            "targetType": "Team",
                            "fallthroughType": "ActiveMembers",
                            "id": "sentry.mail.actions.NotifyEmailAction",
                            "targetIdentifier": 4367234414355,
                        }
                    ],
                    "actionMatch": "any",
                    "filterMatch": "any",
                    "frequency": 60,
                    "name": "High Number of Issues with Production",
                    "dateCreated": "2023-01-15T06:45:34.353346Z",
                    "owner": "team:63562",
                    "createdBy": {
                        "id": 2435786,
                        "name": "John Doe",
                        "email": "john.doe@example.com",
                    },
                    "environment": "prod",
                    "projects": ["melody"],
                    "status": "active",
                    "lastTriggered": "2023-07-15T00:00:00.351236Z",
                    "snooze": False,
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
                "conditions": [
                    {
                        "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                    }
                ],
                "filters": [
                    {
                        "targetType": "Unassigned",
                        "id": "sentry.rules.filters.assigned_to.AssignedToFilter",
                        "targetIdentifier": "",
                    }
                ],
                "actions": [
                    {
                        "targetType": "Member",
                        "fallthroughType": "ActiveMembers",
                        "id": "sentry.mail.actions.NotifyEmailAction",
                        "targetIdentifier": 1523125,
                    }
                ],
                "actionMatch": "any",
                "filterMatch": "all",
                "frequency": 1440,
                "name": "Owner Alert",
                "dateCreated": "2023-09-08T20:00:07.244602Z",
                "owner": "team:74234",
                "createdBy": {"id": 24601, "name": "Jean Valjean", "email": "jean@example.com"},
                "environment": None,
                "projects": ["python"],
                "status": "active",
                "snooze": False,
            },
            status_codes=["201"],
            response_only=True,
        )
    ]
