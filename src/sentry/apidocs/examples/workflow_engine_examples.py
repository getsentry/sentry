from drf_spectacular.utils import OpenApiExample


class WorkflowEngineExamples:
    LIST_ORG_DETECTORS = [
    ]
    LIST_WORKFLOWS = [
    ]
    CREATE_WORKFLOW = [
    ]
    CREATE_DETECTOR = [
        OpenApiExample(
            "Monitor successfully created",
            value={
                "id": "12345",
                "projectId": "1",
                "name": "Example metric monitor",
                "description": "Example description",
                "type": "metric_issue",
                "workflowIds": [],
                "owner": {
                    "type": "user",
                    "id": "12345",
                    "name": "Jane Doe",
                    "email": "jane@sentry.io",
                },
                "createdBy": "12345",
                "dateCreated": "2026-01-08T23:45:13.235259Z",
                "dateUpdated": "2026-01-08T23:45:13.235243Z",
                "dataSources": [
                    {
                        "id": "123456",
                        "organizationId": "1",
                        "type": "snuba_query_subscription",
                        "sourceId": "12345",
                        "queryObj": {
                            "id": "23456",
                            "status": 1,
                            "subscription": None,
                            "snubaQuery": {
                                "id": "45678",
                                "dataset": "events",
                                "query": "is:unresolved",
                                "aggregate": "count()",
                                "timeWindow": 3600,
                                "environment": None,
                                "eventTypes": ["error", "default"],
                                "extrapolationMode": "unknown",
                            },
                        },
                    }
                ],
                "conditionGroup": {
                    "id": "1234567",
                    "organizationId": "1",
                    "logicType": "any",
                    "conditions": [
                        {"id": "2345677", "type": "gt", "comparison": 10, "conditionResult": 75},
                        {"id": "567891", "type": "lte", "comparison": 10, "conditionResult": 0},
                    ],
                    "actions": [],
                },
                "config": {"detectionType": "static"},
                "enabled": True,
                "latestGroup": None,
                "openIssues": 0,
            },
            status_codes=["201"],
            response_only=True,
        )
    ]
