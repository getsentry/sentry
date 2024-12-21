from drf_spectacular.utils import OpenApiExample


class MetricAlertExamples:
    LIST_METRIC_ALERT_RULES = [
        OpenApiExample(
            "List metric alert rules for an organization",
            value=[
                {
                    "id": "7",
                    "name": "Counting Bad Request and Unauthorized Errors in Prod",
                    "organizationId": "237655244234",
                    "queryType": 0,
                    "dataset": "events",
                    "query": "tags[http.status_code]:[400, 401]",
                    "aggregate": "count()",
                    "thresholdType": 0,
                    "resolveThreshold": None,
                    "timeWindow": 1440,
                    "environment": "prod",
                    "triggers": [
                        {
                            "id": "394289",
                            "alertRuleId": "17723",
                            "label": "critical",
                            "thresholdType": 0,
                            "alertThreshold": 100,
                            "resolveThreshold": None,
                            "dateCreated": "2023-09-25T22:15:26.375126Z",
                            "actions": [
                                {
                                    "id": "394280",
                                    "alertRuleTriggerId": "92481",
                                    "type": "slack",
                                    "targetType": "specific",
                                    "targetIdentifier": "30489048931789",
                                    "inputChannelId": "#my-channel",
                                    "integrationId": "8753467",
                                    "sentryAppId": None,
                                    "dateCreated": "2023-09-25T22:15:26.375126Z",
                                }
                            ],
                        },
                    ],
                    "projects": ["super-cool-project"],
                    "owner": "user:53256",
                    "originalAlertRuleId": None,
                    "comparisonDelta": None,
                    "dateModified": "2023-09-25T22:15:26.375126Z",
                    "dateCreated": "2023-09-25T22:15:26.375126Z",
                    "createdBy": {"id": 983948, "name": "John Doe", "email": "john.doe@sentry.io"},
                }
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    CREATE_METRIC_ALERT_RULE = [
        OpenApiExample(
            "Create a metric alert rule for an organization",
            value={
                "id": "177104",
                "name": "Apdex % Check",
                "organizationId": "4505676595200000",
                "queryType": 2,
                "dataset": "metrics",
                "query": "",
                "aggregate": "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
                "thresholdType": 0,
                "resolveThreshold": 80.0,
                "timeWindow": 120,
                "environment": None,
                "triggers": [
                    {
                        "id": "293990",
                        "alertRuleId": "177104",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 75,
                        "resolveThreshold": 80.0,
                        "dateCreated": "2023-09-25T22:01:28.673305Z",
                        "actions": [
                            {
                                "id": "281887",
                                "alertRuleTriggerId": "293990",
                                "type": "email",
                                "targetType": "team",
                                "targetIdentifier": "2378589792734981",
                                "inputChannelId": None,
                                "integrationId": None,
                                "sentryAppId": None,
                                "dateCreated": "2023-09-25T22:01:28.680793Z",
                            }
                        ],
                    },
                    {
                        "id": "492849",
                        "alertRuleId": "482923",
                        "label": "warning",
                        "thresholdType": 1,
                        "alertThreshold": 50,
                        "resolveThreshold": 80,
                        "dateCreated": "2023-09-25T22:01:28.673305Z",
                        "actions": [],
                    },
                ],
                "projects": ["our-project"],
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": 10080,
                "dateModified": "2023-09-25T22:01:28.637506Z",
                "dateCreated": "2023-09-25T22:01:28.637514Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Jane Doe",
                    "email": "jane.doe@sentry.io",
                },
            },
            status_codes=["201"],
            response_only=True,
        )
    ]

    GET_METRIC_ALERT_RULE = [
        OpenApiExample(
            "Get detailed view about a metric alert rule",
            value={
                "id": "177412243058",
                "name": "My Metric Alert Rule",
                "organizationId": "4505676595200000",
                "queryType": 0,
                "dataset": "events",
                "query": "",
                "aggregate": "count_unique(user)",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 60,
                "environment": None,
                "triggers": [
                    {
                        "id": "294385908",
                        "alertRuleId": "177412243058",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 31.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-26T22:14:17.557579Z",
                        "actions": [],
                    }
                ],
                "projects": ["my-coolest-project"],
                "owner": "team:29508397892374892",
                "dateModified": "2023-09-26T22:14:17.522166Z",
                "dateCreated": "2023-09-26T22:14:17.522196Z",
                "createdBy": {
                    "id": 2834985497897,
                    "name": "Somebody That I Used to Know",
                    "email": "anon@sentry.io",
                },
                "eventTypes": ["default", "error"],
            },
            status_codes=["200"],
            response_only=True,
        )
    ]

    UPDATE_METRIC_ALERT_RULE = [
        OpenApiExample(
            "Update a metric alert rule",
            value={
                "id": "345989573",
                "name": "P30 Transaction Duration",
                "organizationId": "02403489017",
                "queryType": 1,
                "dataset": "transactions",
                "query": "",
                "aggregate": "percentile(transaction.duration,0.3)",
                "thresholdType": 1,
                "resolveThreshold": None,
                "timeWindow": 60,
                "environment": None,
                "triggers": [
                    {
                        "id": "0543809890",
                        "alertRuleId": "345989573",
                        "label": "critical",
                        "thresholdType": 1,
                        "alertThreshold": 70.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:35:31.832084Z",
                        "actions": [],
                    }
                ],
                "projects": ["backend"],
                "owner": "team:9390258908",
                "originalAlertRuleId": None,
                "comparisonDelta": 10080.0,
                "dateModified": "2023-09-25T23:35:31.787866Z",
                "dateCreated": "2023-09-25T23:35:31.787875Z",
                "createdBy": {
                    "id": 902843590658,
                    "name": "Spongebob Squarepants",
                    "email": "spongebob.s@example.com",
                },
            },
            status_codes=["200"],
            response_only=True,
        )
    ]

    GET_METRIC_ALERT_ACTIVATIONS = [
        OpenApiExample(
            "Fetch a list of activations for a metric alert rule",
            value=[
                {
                    "id": "1",
                    "alertRuleId": "1",
                    "dateCreated": "2023-09-25T23:35:31.787875Z",
                    "finishedAt": "2023-09-25T23:35:31.787866Z",
                    "metricValue": 100,
                    "querySubscriptionId": "1",
                    "isComplete": True,
                    "activator": "1",
                    "conditionType": "0",
                }
            ],
        )
    ]

    GET_METRIC_ALERT_ANOMALIES = [
        OpenApiExample(
            "Fetch a list of anomalies for a metric alert rule",
            value=[
                {
                    "timestamp": 0.1,
                    "value": 100.0,
                    "anomaly": {
                        "anomaly_type": "anomaly_higher_confidence",
                        "anomaly_value": 100,
                    },
                }
            ],
        )
    ]
