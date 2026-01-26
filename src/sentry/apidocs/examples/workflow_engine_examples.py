from drf_spectacular.utils import OpenApiExample


class WorkflowEngineExamples:
    GET_WORKFLOW = [
        OpenApiExample(
            "Fetch an Alert",
            value={
                "id": "6789123",
                "name": "My Alert",
                "organizationId": "1",
                "createdBy": "1234567",
                "dateCreated": "2026-01-14T20:08:32.273220Z",
                "dateUpdated": "2026-01-14T20:08:32.273209Z",
                "triggers": {
                    "id": "345678",
                    "organizationId": "1",
                    "logicType": "any-short",
                    "conditions": [
                        {
                            "id": "234",
                            "type": "first_seen_event",
                            "comparison": True,
                            "conditionResult": True,
                        },
                        {
                            "id": "567",
                            "type": "issue_resolved_trigger",
                            "comparison": True,
                            "conditionResult": True,
                        },
                        {
                            "id": "891",
                            "type": "reappeared_event",
                            "comparison": True,
                            "conditionResult": True,
                        },
                        {
                            "id": "789",
                            "type": "regression_event",
                            "comparison": True,
                            "conditionResult": True,
                        },
                    ],
                    "actions": [],
                },
                "actionFilters": [
                    {
                        "id": "345678",
                        "organizationId": "1",
                        "logicType": "any-short",
                        "conditions": [
                            {
                                "id": "234567",
                                "type": "issue_priority_deescalating",
                                "comparison": True,
                                "conditionResult": True,
                            }
                        ],
                        "actions": [
                            {
                                "id": "45678",
                                "type": "slack",
                                "integrationId": "1",
                                "data": {},
                                "config": {
                                    "targetType": "specific",
                                    "targetDisplay": "@jane-doe",
                                    "targetIdentifier": "ABCDE123456",
                                },
                                "status": "active",
                            }
                        ],
                    }
                ],
                "environment": None,
                "config": {"frequency": 1440},
                "detectorIds": ["1234567"],
                "enabled": True,
                "lastTriggered": None,
            },
            status_codes=["200"],
            response_only=True,
        )
    ]
    UPDATE_WORKFLOW = [
        OpenApiExample(
            "Update an Alert",
            value={
                "id": "1234567",
                "name": "My Updated Alert",
                "organizationId": "1",
                "createdBy": "23456",
                "dateCreated": "2026-01-14T20:08:32.273220Z",
                "dateUpdated": "2026-01-14T21:59:45.609912Z",
                "triggers": {
                    "id": "12345",
                    "organizationId": "1",
                    "logicType": "any-short",
                    "conditions": [
                        {
                            "id": "1234",
                            "type": "first_seen_event",
                            "comparison": True,
                            "conditionResult": True,
                        },
                        {
                            "id": "2345",
                            "type": "issue_resolved_trigger",
                            "comparison": True,
                            "conditionResult": True,
                        },
                        {
                            "id": "3456",
                            "type": "reappeared_event",
                            "comparison": True,
                            "conditionResult": True,
                        },
                        {
                            "id": "4567",
                            "type": "regression_event",
                            "comparison": True,
                            "conditionResult": True,
                        },
                    ],
                    "actions": [],
                },
                "actionFilters": [
                    {
                        "id": "1234567",
                        "organizationId": "1",
                        "logicType": "any-short",
                        "conditions": [
                            {
                                "id": "345678",
                                "type": "issue_priority_deescalating",
                                "comparison": True,
                                "conditionResult": True,
                            }
                        ],
                        "actions": [
                            {
                                "id": "56789",
                                "type": "slack",
                                "integrationId": "1",
                                "data": {},
                                "config": {
                                    "targetType": "specific",
                                    "targetDisplay": "@jane-doe",
                                    "targetIdentifier": "ABCDE123456",
                                },
                                "status": "active",
                            }
                        ],
                    }
                ],
                "environment": None,
                "config": {"frequency": 1440},
                "detectorIds": ["12345678"],
                "enabled": True,
                "lastTriggered": None,
            },
            status_codes=["200"],
            response_only=True,
        )
    ]
    GET_DETECTOR = [
        OpenApiExample(
            "Fetch a Monitor",
            value={
                "id": "123456",
                "projectId": "1",
                "name": "High Number of Errors",
                "description": None,
                "type": "metric_issue",
                "workflowIds": ["45678"],
                "owner": {"type": "team", "id": "1234567", "name": "example-team"},
                "createdBy": "789123",
                "dateCreated": "2025-03-25T17:50:45.587657Z",
                "dateUpdated": "2025-07-22T17:10:45.069457Z",
                "dataSources": [
                    {
                        "id": "34567",
                        "organizationId": "1",
                        "type": "snuba_query_subscription",
                        "sourceId": "56789",
                        "queryObj": {
                            "id": "23456",
                            "status": 0,
                            "subscription": "12/345acb678def912ghi",
                            "snubaQuery": {
                                "id": "12345",
                                "dataset": "events",
                                "query": "",
                                "aggregate": "count()",
                                "timeWindow": 900,
                                "environment": None,
                                "eventTypes": ["error"],
                                "extrapolationMode": "unknown",
                            },
                        },
                    }
                ],
                "conditionGroup": {
                    "id": "345678",
                    "organizationId": "1",
                    "logicType": "any",
                    "conditions": [
                        {
                            "id": "234567",
                            "type": "anomaly_detection",
                            "comparison": {
                                "seasonality": "auto",
                                "sensitivity": "low",
                                "thresholdType": 0,
                            },
                            "conditionResult": 75,
                        }
                    ],
                    "actions": [],
                },
                "config": {"detectionType": "dynamic", "comparisonDelta": None},
                "enabled": True,
                "latestGroup": {
                    "id": "123456789",
                    "title": "High Number of Errors",
                    "culprit": "",
                    "shortId": "EXAMPLE-1A2B",
                    "level": "error",
                    "status": "resolved",
                    "substatus": None,
                    "platform": "python",
                    "project": {
                        "id": "1",
                        "name": "Backend",
                        "slug": "sentry",
                        "platform": "python",
                    },
                    "type": "generic",
                    "issueType": "metric_issue",
                    "issueCategory": "metric",
                    "metadata": {
                        "title": "High Number of Errors",
                        "value": "Detected an error",
                        "initial_priority": 75,
                    },
                    "numComments": 0,
                    "firstSeen": "2025-07-21T14:46:07.845207Z",
                    "lastSeen": "2026-01-12T16:16:26.355334Z",
                },
                "openIssues": 0,
            },
            status_codes=["200"],
            response_only=True,
        )
    ]
    UPDATE_DETECTOR = [
        OpenApiExample(
            "Update a Monitor",
            value={
                "id": "12345",
                "projectId": "1",
                "name": "Updated monitor",
                "description": None,
                "type": "metric_issue",
                "workflowIds": [],
                "owner": {
                    "type": "user",
                    "id": "4567",
                    "name": "Jane Doe",
                    "email": "jane@example.io",
                },
                "createdBy": "45678",
                "dateCreated": "2026-01-09T18:47:41.596427Z",
                "dateUpdated": "2026-01-12T21:30:07.354861Z",
                "dataSources": [
                    {
                        "id": "2345",
                        "organizationId": "1",
                        "type": "snuba_query_subscription",
                        "sourceId": "1234",
                        "queryObj": {
                            "id": "3456",
                            "status": 0,
                            "subscription": "55/abc123def456ghi789",
                            "snubaQuery": {
                                "id": "56789",
                                "dataset": "events_analytics_platform",
                                "query": "",
                                "aggregate": "p95(measurements.lcp)",
                                "timeWindow": 3600,
                                "environment": None,
                                "eventTypes": ["trace_item_span"],
                                "extrapolationMode": "unknown",
                            },
                        },
                    }
                ],
                "conditionGroup": {
                    "id": "12345678",
                    "organizationId": "1",
                    "logicType": "any",
                    "conditions": [
                        {"id": "234567", "type": "gt", "comparison": 5, "conditionResult": 75},
                        {"id": "234568", "type": "lte", "comparison": 5, "conditionResult": 0},
                    ],
                    "actions": [],
                },
                "config": {"detectionType": "static"},
                "enabled": True,
                "alertRuleId": None,
                "ruleId": None,
                "latestGroup": {
                    "id": "123456789",
                    "title": "Test monitor",
                    "culprit": "",
                    "shortId": "SENTRY-1A2B",
                    "level": "error",
                    "status": "resolved",
                    "substatus": None,
                    "platform": "python",
                    "project": {
                        "id": "1",
                        "name": "Backend",
                        "slug": "sentry",
                        "platform": "python",
                    },
                    "type": "generic",
                    "issueType": "metric_issue",
                    "issueCategory": "metric",
                    "metadata": {
                        "title": "Test monitor",
                        "value": "Critical: Number of events in the last hour above 5",
                        "initial_priority": 75,
                    },
                    "numComments": 0,
                    "firstSeen": "2026-01-09T18:48:15.250134Z",
                    "lastSeen": "2026-01-09T18:48:15.250134Z",
                },
                "openIssues": 0,
            },
            status_codes=["200"],
            response_only=True,
        )
    ]
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
                        "name": "jane@example.com",
                        "email": "jane@example.com",
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
            status_codes=["200"],
            response_only=True,
        )
    ]
    LIST_WORKFLOWS = [
        OpenApiExample(
            "List all workflows in an organization",
            value=[
                {
                    "id": "123",
                    "name": "Send a notification for high priority issues",
                    "organizationId": "1",
                    "createdBy": None,
                    "dateCreated": "2025-03-18T20:48:55.495059Z",
                    "dateUpdated": "2025-03-18T20:48:55.579094Z",
                    "triggers": {
                        "id": "12345",
                        "organizationId": "1",
                        "logicType": "any-short",
                        "conditions": [
                            {
                                "id": "2345",
                                "type": "new_high_priority_issue",
                                "comparison": True,
                                "conditionResult": True,
                            },
                            {
                                "id": "3456",
                                "type": "existing_high_priority_issue",
                                "comparison": True,
                                "conditionResult": True,
                            },
                        ],
                        "actions": [],
                    },
                    "actionFilters": [
                        {
                            "id": "5678",
                            "organizationId": "1",
                            "logicType": "all",
                            "conditions": [],
                            "actions": [
                                {
                                    "id": "234",
                                    "type": "email",
                                    "integrationId": None,
                                    "data": {"fallthroughType": "ActiveMembers"},
                                    "config": {
                                        "targetType": "issue_owners",
                                        "targetDisplay": None,
                                        "targetIdentifier": None,
                                    },
                                    "status": "active",
                                }
                            ],
                        }
                    ],
                    "environment": None,
                    "config": {"frequency": 30},
                    "detectorIds": [],
                    "enabled": True,
                    "lastTriggered": None,
                },
                {
                    "id": "456",
                    "name": "Notify team #example-team",
                    "organizationId": "1",
                    "createdBy": "34567",
                    "dateCreated": "2026-01-15T23:46:39.594915Z",
                    "dateUpdated": "2026-01-15T23:46:39.594903Z",
                    "triggers": {
                        "id": "12345",
                        "organizationId": "1",
                        "logicType": "any-short",
                        "conditions": [],
                        "actions": [],
                    },
                    "actionFilters": [
                        {
                            "id": "6789",
                            "organizationId": "1",
                            "logicType": "any-short",
                            "conditions": [
                                {
                                    "id": "5678",
                                    "type": "event_frequency_count",
                                    "comparison": {"value": 100, "interval": "1h"},
                                    "conditionResult": True,
                                }
                            ],
                            "actions": [
                                {
                                    "id": "1234",
                                    "type": "email",
                                    "integrationId": None,
                                    "data": {},
                                    "config": {
                                        "targetType": "team",
                                        "targetDisplay": None,
                                        "targetIdentifier": "1234567890",
                                    },
                                    "status": "active",
                                }
                            ],
                        }
                    ],
                    "environment": None,
                    "config": {"frequency": 1440},
                    "detectorIds": [],
                    "enabled": True,
                    "lastTriggered": None,
                },
                {
                    "id": "789",
                    "name": "Notify Jane Doe",
                    "organizationId": "1",
                    "createdBy": "2345",
                    "dateCreated": "2026-01-15T23:46:39.594915Z",
                    "dateUpdated": "2026-01-15T23:49:57.697583Z",
                    "triggers": {
                        "id": "56789",
                        "organizationId": "1",
                        "logicType": "any-short",
                        "conditions": [],
                        "actions": [],
                    },
                    "actionFilters": [
                        {
                            "id": "56789",
                            "organizationId": "1",
                            "logicType": "any-short",
                            "conditions": [
                                {
                                    "id": "234567",
                                    "type": "event_unique_user_frequency_count",
                                    "comparison": {
                                        "value": 100,
                                        "filters": [{"key": "foo", "match": "eq", "value": "bar"}],
                                        "interval": "1h",
                                    },
                                    "conditionResult": True,
                                }
                            ],
                            "actions": [
                                {
                                    "id": "456789",
                                    "type": "email",
                                    "integrationId": None,
                                    "data": {},
                                    "config": {
                                        "targetType": "user",
                                        "targetDisplay": None,
                                        "targetIdentifier": "123456",
                                    },
                                    "status": "active",
                                }
                            ],
                        }
                    ],
                    "environment": None,
                    "config": {"frequency": 1440},
                    "detectorIds": [],
                    "enabled": True,
                    "lastTriggered": None,
                },
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]
    CREATE_WORKFLOW = [
        OpenApiExample(
            "Workflow successfully created",
            value={
                "id": "1234567",
                "name": "Notify Jane Doe",
                "organizationId": "1",
                "createdBy": "2345",
                "dateCreated": "2026-01-13T21:21:15.975384Z",
                "dateUpdated": "2026-01-13T21:21:15.975376Z",
                "triggers": {
                    "id": "456789",
                    "organizationId": "1",
                    "logicType": "any-short",
                    "conditions": [
                        {
                            "id": "234567",
                            "type": "first_seen_event",
                            "comparison": True,
                            "conditionResult": True,
                        },
                        {
                            "id": "1234567",
                            "type": "issue_resolved_trigger",
                            "comparison": True,
                            "conditionResult": True,
                        },
                        {
                            "id": "678912",
                            "type": "reappeared_event",
                            "comparison": True,
                            "conditionResult": True,
                        },
                        {
                            "id": "7891234",
                            "type": "regression_event",
                            "comparison": True,
                            "conditionResult": True,
                        },
                    ],
                    "actions": [],
                },
                "actionFilters": [
                    {
                        "id": "45678",
                        "organizationId": "1",
                        "logicType": "any-short",
                        "conditions": [
                            {
                                "id": "23456789",
                                "type": "issue_occurrences",
                                "comparison": {"value": 10},
                                "conditionResult": True,
                            }
                        ],
                        "actions": [
                            {
                                "id": "1234789",
                                "type": "email",
                                "integrationId": None,
                                "data": {},
                                "config": {
                                    "targetType": "user",
                                    "targetDisplay": None,
                                    "targetIdentifier": "6789",
                                },
                                "status": "active",
                            }
                        ],
                    }
                ],
                "environment": None,
                "config": {"frequency": 1440},
                "detectorIds": ["1000"],
                "enabled": True,
                "lastTriggered": None,
            },
            status_codes=["201"],
            response_only=True,
        )
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
