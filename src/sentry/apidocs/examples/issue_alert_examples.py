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

    # TODO: can i reuse the sample used for creating a rule?
    GET_PROJECT_RULE = []

    UPDATE_PROJECT_RULE = []

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