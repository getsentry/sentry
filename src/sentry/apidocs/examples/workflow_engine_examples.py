from drf_spectacular.utils import OpenApiExample


class WorkflowEngineExamples:
    LIST_ORG_DETECTORS = [
        OpenApiExample(
            "List all monitors in an organization",
            value=[
                {
                    "id": "123",
                    "projectId": "1",
                    "name": "Error Monitor",
                    "description": None,
                    "type": "error",
                    "workflowIds": ["12345"],
                    "owner": None,
                    "createdBy": None,
                    "dateCreated": "2025-03-12T11:15:50.764865Z",
                    "dateUpdated": "2025-06-17T14:04:02.485354Z",
                    "dataSources": None,
                    "conditionGroup": None,
                    "config": {},
                    "enabled": True,
                    "latestGroup": {
                        "id": "123456789",
                        "title": "This is an example Python exception",
                        "culprit": "/api/0/test/example/",
                        "shortId": "SENTRY-ABC12",
                        "level": "info",
                        "status": "unresolved",
                        "substatus": "escalating",
                        "platform": "python",
                        "project": {
                            "id": "1",
                            "name": "Example",
                            "slug": "sentry",
                            "platform": "python",
                        },
                        "type": "default",
                        "issueType": "error",
                        "issueCategory": "error",
                        "metadata": {
                            "title": "This is an example Python exception",
                            "sdk": {
                                "name": "sentry.python.django",
                                "name_normalized": "sentry.python",
                            },
                            "severity": 0.0,
                            "severity_reason": "log_level_info",
                            "initial_priority": 25,
                        },
                        "numComments": 0,
                        "firstSeen": "2026-01-08T21:00:59.737468Z",
                        "lastSeen": "2026-01-08T21:23:45.723716Z",
                    },
                    "openIssues": 100,
                },
                {
                    "id": "234567891",
                    "projectId": "1",
                    "name": "[us] Example",
                    "description": None,
                    "type": "uptime_domain_failure",
                    "workflowIds": [],
                    "owner": {"type": "team", "id": "1234", "name": "abc"},
                    "createdBy": None,
                    "dateCreated": "2025-04-21T21:56:32.445528Z",
                    "dateUpdated": "2025-10-23T00:07:24.809466Z",
                    "dataSources": [
                        {
                            "id": "271218",
                            "organizationId": "1",
                            "type": "uptime_subscription",
                            "sourceId": "267409",
                            "queryObj": {
                                "url": "https://example.com",
                                "method": "POST",
                                "body": '{\n  "level": "info",\n  "message": "Test-Event",\n  "platform": "javascript"\n}',
                                "headers": [
                                    ["content-type", "application/json"],
                                    ["user-agent", "Sentry Test"],
                                ],
                                "intervalSeconds": 60,
                                "timeoutMs": 5000,
                                "traceSampling": False,
                            },
                        }
                    ],
                    "conditionGroup": {
                        "id": "56789",
                        "organizationId": "1",
                        "logicType": "any",
                        "conditions": [
                            {
                                "id": "123456",
                                "type": "eq",
                                "comparison": "failure",
                                "conditionResult": 75,
                            },
                            {
                                "id": "234567",
                                "type": "eq",
                                "comparison": "success",
                                "conditionResult": 0,
                            },
                        ],
                        "actions": [],
                    },
                    "config": {
                        "mode": 1,
                        "environment": "us",
                        "downtimeThreshold": 3,
                        "recoveryThreshold": 1,
                    },
                    "enabled": True,
                    "latestGroup": None,
                    "openIssues": 0,
                },
                {
                    "id": "1234567",
                    "projectId": "123",
                    "name": "Test Alert",
                    "description": None,
                    "type": "metric_issue",
                    "workflowIds": ["1234567"],
                    "owner": {
                        "type": "user",
                        "id": "12345",
                        "name": "colleen@sentry.io",
                        "email": "colleen@sentry.io",
                    },
                    "createdBy": "12345",
                    "dateCreated": "2025-04-28T22:46:12.469771Z",
                    "dateUpdated": "2025-07-29T20:57:06.680844Z",
                    "dataSources": [
                        {
                            "id": "56789",
                            "organizationId": "1",
                            "type": "snuba_query_subscription",
                            "sourceId": "45678",
                            "queryObj": {
                                "id": "34567",
                                "status": 0,
                                "subscription": "12/3456789",
                                "snubaQuery": {
                                    "id": "56789",
                                    "dataset": "events_analytics_platform",
                                    "query": "",
                                    "aggregate": "avg(span.duration)",
                                    "timeWindow": 14400,
                                    "environment": None,
                                    "eventTypes": ["trace_item_span"],
                                    "extrapolationMode": "unknown",
                                },
                            },
                        }
                    ],
                    "conditionGroup": {
                        "id": "12345",
                        "organizationId": "1",
                        "logicType": "any",
                        "conditions": [
                            {
                                "id": "456789",
                                "type": "gt",
                                "comparison": 1600.0,
                                "conditionResult": 75,
                            },
                            {
                                "id": "345678",
                                "type": "lte",
                                "comparison": 1600.0,
                                "conditionResult": 0,
                            },
                        ],
                        "actions": [],
                    },
                    "config": {"detectionType": "static", "comparisonDelta": None},
                    "enabled": True,
                    "latestGroup": None,
                    "openIssues": 0,
                },
            ],
            status_codes=["201"],
            response_only=True,
        )
    ]

    GET_DETECTOR_WORKFLOW = [
        OpenApiExample(
            "Fetch a detector workflow connection",
            value={"id": "123", "detectorId": "456", "workflowId": "789"},
        )
    ]
