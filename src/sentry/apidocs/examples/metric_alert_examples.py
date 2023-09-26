from drf_spectacular.utils import OpenApiExample


class MetricAlertExamples:
    LIST_METRIC_ALERT_RULES = [
        OpenApiExample(
            "List metric alert rules for an organization",
            value=[
                {
                    "id": "7",
                    "name": "My Metric Alert",
                    "organizationId": "237655244234",  # TODO: CHECK
                    "status": 0,  # TODO: CHECK
                    "owner": "user:53256",
                    "environment": "prod",
                    "projects": ["super-cool-project"],
                    "triggers": [
                        {
                            "label": "critical",
                            "alertThreshold": 100,
                            "actions": [
                                {
                                    "type": "slack",
                                    "targetIdentifier": "#my-channel",
                                    "targetType": "specific",
                                    "integration": 8753467,
                                }
                            ],
                        },
                        {
                            "label": "warning",
                            "alertThreshold": 500,
                            "actions": [
                                {"type": "email", "targetType": "user", "targetIdentifier": 563456},
                            ],
                        },
                    ],
                    "aggregate": "count()",
                    "query": 'tags[browser]:["Safari", "Google Chrome"]',
                    "timeWindow": "1440",
                    "thresholdType": 0,
                    "thresholdPeriod": 1,
                    "eventTypes": ["error"],
                }
            ],
        )
    ]

    CREATE_METRIC_ALERT_RULE = [
        OpenApiExample(
            "Create a metric alert rule for an organization",
            value={  # normal num_errors metric alert
                "id": "177104",
                "name": "weenus",
                "organizationId": "4505676595200000",  # TODO: check
                "status": 0,  # TODO: check
                "queryType": 0,  # event.type:error
                "dataset": "events",  # TODO: check
                "query": "",
                "aggregate": "count()",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 60.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,  # TODO: check
                "triggers": [
                    {
                        "id": "293990",
                        "alertRuleId": "177104",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 500.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T22:01:28.673305Z",
                        "actions": [
                            {
                                "id": "281887",
                                "alertRuleTriggerId": "293990",
                                "type": "email",
                                "targetType": "user",
                                "targetIdentifier": "2837708",
                                "inputChannelId": None,
                                "integrationId": None,
                                "sentryAppId": None,
                                "dateCreated": "2023-09-25T22:01:28.680793Z",
                                "desc": "Send a notification to isabella.enriquez@sentry.io",
                            }
                        ],
                    }
                ],
                "projects": ["python"],
                "includeAllProjects": False,  # TODO: check
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,  # TODO: check
                "comparisonDelta": None,
                "dateModified": "2023-09-25T22:01:28.637506Z",
                "dateCreated": "2023-09-25T22:01:28.637514Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    USERS_EXPERIENCING_ERRORS = [  # percentage based thresholds
        OpenApiExample(
            "",
            value={
                "id": "177108",
                "name": "usher",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 0,  # event.type:error
                "dataset": "events",
                "query": "http.status_code:400",
                "aggregate": "count_unique(user)",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 60.0,
                "environment": None,
                "resolution": 2.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "293997",
                        "alertRuleId": "177108",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 100.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T22:15:26.375126Z",
                        "actions": [
                            {
                                "id": "281894",
                                "alertRuleTriggerId": "293997",
                                "type": "email",
                                "targetType": "team",
                                "targetIdentifier": "4505676595200000",
                                "inputChannelId": None,
                                "integrationId": None,
                                "sentryAppId": None,
                                "dateCreated": "2023-09-25T22:15:26.380989Z",
                                "desc": "Send an email to members of #isabellas-test-org",
                            }
                        ],
                    },
                    {
                        "id": "293998",
                        "alertRuleId": "177108",
                        "label": "warning",
                        "thresholdType": 0,
                        "alertThreshold": 50.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T22:15:26.385698Z",
                        "actions": [
                            {
                                "id": "281895",
                                "alertRuleTriggerId": "293998",
                                "type": "email",
                                "targetType": "user",
                                "targetIdentifier": "2837708",
                                "inputChannelId": None,
                                "integrationId": None,
                                "sentryAppId": None,
                                "dateCreated": "2023-09-25T22:15:26.391870Z",
                                "desc": "Send a notification to isabella.enriquez@sentry.io",
                            }
                        ],
                    },
                ],
                "projects": ["python"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": 10080.0,  # "users experiencing errors is x%% higher in timeWindow compared to the same time 10080 minutes ago"
                "dateModified": "2023-09-25T22:15:26.347126Z",
                "dateCreated": "2023-09-25T22:15:26.347134Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    CRASH_FREE_SESSION_RATE = [
        OpenApiExample(
            "",
            value={
                "id": "177111",
                "name": "elmo",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 2,  # n/a
                "dataset": "metrics",
                "query": "",
                "aggregate": "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
                "thresholdType": 1,
                "resolveThreshold": None,
                "timeWindow": 1440.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294003",
                        "alertRuleId": "177111",
                        "label": "critical",
                        "thresholdType": 1,
                        "alertThreshold": 20.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T22:22:40.964755Z",
                        "actions": [
                            {
                                "id": "281900",
                                "alertRuleTriggerId": "294003",
                                "type": "email",
                                "targetType": "team",
                                "targetIdentifier": "4505676595200000",
                                "inputChannelId": None,
                                "integrationId": None,
                                "sentryAppId": None,
                                "dateCreated": "2023-09-25T22:22:40.973369Z",
                                "desc": "Send an email to members of #isabellas-test-org",
                            }
                        ],
                    },
                    {
                        "id": "294004",
                        "alertRuleId": "177111",
                        "label": "warning",
                        "thresholdType": 1,
                        "alertThreshold": 60.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T22:22:40.978679Z",
                        "actions": [],
                    },
                ],
                "projects": ["python"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T22:22:40.910151Z",
                "dateCreated": "2023-09-25T22:22:40.910168Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    CRASH_FREE_USER = [
        OpenApiExample(
            "",
            value={
                "id": "177113",
                "name": "yipee",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 2,  # n/a
                "dataset": "metrics",
                "query": "",
                "aggregate": "percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
                "thresholdType": 1,
                "resolveThreshold": 80.0,
                "timeWindow": 120.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294006",
                        "alertRuleId": "177113",
                        "label": "critical",
                        "thresholdType": 1,
                        "alertThreshold": 60.0,
                        "resolveThreshold": 80.0,
                        "dateCreated": "2023-09-25T22:57:08.682913Z",
                        "actions": [],
                    }
                ],
                "projects": ["dotnet-aspnetcore"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T22:57:38.678647Z",
                "dateCreated": "2023-09-25T22:57:08.646207Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    THROUGHPUT = [
        OpenApiExample(
            "",
            value={  # TODO: percentage based threshold
                "id": "177114",
                "name": "yikes on a bike",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,  # event.type:transaction
                "dataset": "transactions",
                "query": "",
                "aggregate": "count()",
                "thresholdType": 0,
                "resolveThreshold": 50.0,
                "timeWindow": 60.0,
                "environment": "production",
                "resolution": 2.0,  # threshold type (percentage vs static)?
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294007",
                        "alertRuleId": "177114",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 65.0,
                        "resolveThreshold": 50.0,
                        "dateCreated": "2023-09-25T23:04:10.317671Z",
                        "actions": [],
                    }
                ],
                "projects": ["frontend-tutorial"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": 15.0,
                "dateModified": "2023-09-25T23:04:10.280612Z",
                "dateCreated": "2023-09-25T23:04:10.280622Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    TRANSACTION_DURATION = [
        OpenApiExample(
            "",
            value={
                "id": "177115",
                "name": "avg transaction duration",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,  # event.type:transaction
                "dataset": "generic_metrics",
                "query": "",
                "aggregate": "avg(transaction.duration)",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 10.0,
                "environment": "production",
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294008",
                        "alertRuleId": "177115",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 300.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:29:45.391988Z",
                        "actions": [],
                    }
                ],
                "projects": ["frontend-tutorial"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T23:29:45.346166Z",
                "dateCreated": "2023-09-25T23:29:45.346175Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    TRANSACTION_DURATION_P95 = [
        OpenApiExample(
            "",
            value={
                "id": "177121",
                "name": "transaction p95",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,
                "dataset": "generic_metrics",
                "query": "",
                "aggregate": "p95(transaction.duration)",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 60.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294015",
                        "alertRuleId": "177121",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 246.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:47:21.794659Z",
                        "actions": [],
                    }
                ],
                "projects": ["dotnet-aspnetcore"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T23:47:21.766336Z",
                "dateCreated": "2023-09-25T23:47:21.766344Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    TRANSACTION_DURATION_CUSTOM_P = [  # Percentage-based threshold
        OpenApiExample(
            "",
            value={
                "id": "177116",
                "name": "transaction p30 custom",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,  # event.type:transaction
                "dataset": "transactions",
                "query": "",
                "aggregate": "percentile(transaction.duration,0.3)",
                "thresholdType": 1,
                "resolveThreshold": None,
                "timeWindow": 60.0,
                "environment": None,
                "resolution": 2.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294009",
                        "alertRuleId": "177116",
                        "label": "critical",
                        "thresholdType": 1,
                        "alertThreshold": 70.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:35:31.832084Z",
                        "actions": [],
                    }
                ],
                "projects": ["frontend-tutorial"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": 10080.0,
                "dateModified": "2023-09-25T23:35:31.787866Z",
                "dateCreated": "2023-09-25T23:35:31.787875Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    APDEX = [
        OpenApiExample(
            "",
            value={
                "id": "177117",
                "name": "reflection",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,  # event.type:transaction
                "dataset": "transactions",
                "query": "",
                "aggregate": "apdex(300)",
                "thresholdType": 1,
                "resolveThreshold": None,
                "timeWindow": 120.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294010",
                        "alertRuleId": "177117",
                        "label": "critical",
                        "thresholdType": 1,
                        "alertThreshold": 157.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:37:37.422493Z",
                        "actions": [],
                    }
                ],
                "projects": ["unity"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T23:37:37.392384Z",
                "dateCreated": "2023-09-25T23:37:37.392411Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    FAILURE_RATE = [  # percentage-based
        OpenApiExample(
            "",
            value={
                "id": "177118",
                "name": "spineless pale pathetic lot",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,
                "dataset": "transactions",
                "query": "",
                "aggregate": "failure_rate()",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 60.0,
                "environment": None,
                "resolution": 2.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294011",
                        "alertRuleId": "177118",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 0.04999999999999716,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:40:20.302262Z",
                        "actions": [],
                    },
                    {
                        "id": "294012",
                        "alertRuleId": "177118",
                        "label": "warning",
                        "thresholdType": 0,
                        "alertThreshold": 0.010000000000005116,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:40:20.310460Z",
                        "actions": [],
                    },
                ],
                "projects": ["unity"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": 1440.0,
                "dateModified": "2023-09-25T23:40:20.154564Z",
                "dateCreated": "2023-09-25T23:40:20.154572Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    LCP_AVG = [
        OpenApiExample(
            "",
            value={
                "id": "177119",
                "name": "lcp avg",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,
                "dataset": "generic_metrics",
                "query": "",
                "aggregate": "avg(measurements.lcp)",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 60.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294013",
                        "alertRuleId": "177119",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 300.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:43:12.073192Z",
                        "actions": [],
                    }
                ],
                "projects": ["dotnet-aspnetcore"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T23:43:12.020078Z",
                "dateCreated": "2023-09-25T23:43:12.020088Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    LCP_P95 = [
        OpenApiExample(
            "",
            value={
                "id": "177120",
                "name": "lcp p95",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,
                "dataset": "generic_metrics",
                "query": "",
                "aggregate": "p95(measurements.lcp)",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 60.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294014",
                        "alertRuleId": "177120",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 500.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:44:33.716347Z",
                        "actions": [],
                    }
                ],
                "projects": ["dotnet-aspnetcore"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T23:44:33.683802Z",
                "dateCreated": "2023-09-25T23:44:33.683814Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    LCP_PCUSTOM = [
        OpenApiExample(
            "",
            value={
                "id": "177122",
                "name": "custom lcp",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,
                "dataset": "transactions",
                "query": "",
                "aggregate": "percentile(measurements.lcp,0.2)",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 60.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294016",
                        "alertRuleId": "177122",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 100.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:48:56.032449Z",
                        "actions": [],
                    }
                ],
                "projects": ["dotnet-aspnetcore"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T23:48:55.999350Z",
                "dateCreated": "2023-09-25T23:48:55.999358Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
                "latestIncident": None,
                "excludedProjects": [],
                "eventTypes": ["transaction"],
                "snooze": False,
            },
        )
    ]

    FID_P100 = [
        OpenApiExample(
            "",
            value={
                "id": "177123",
                "name": "fid p100",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,
                "dataset": "generic_metrics",
                "query": "",
                "aggregate": "p100(measurements.fid)",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 60.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294017",
                        "alertRuleId": "177123",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 250.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:50:09.590924Z",
                        "actions": [],
                    }
                ],
                "projects": ["dotnet-aspnetcore"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T23:50:09.540047Z",
                "dateCreated": "2023-09-25T23:50:09.540057Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    FID_CUSTOM = [
        OpenApiExample(
            "",
            value={
                "id": "177124",
                "name": "FID custom",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,
                "dataset": "transactions",
                "query": "",
                "aggregate": "percentile(measurements.fid,0.45)",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 60.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294018",
                        "alertRuleId": "177124",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 500.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:51:19.113092Z",
                        "actions": [],
                    }
                ],
                "projects": ["dotnet-aspnetcore"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T23:51:19.081364Z",
                "dateCreated": "2023-09-25T23:51:19.081373Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    CLS = [
        OpenApiExample(
            "",
            value={
                "id": "177125",
                "name": "kachow",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,
                "dataset": "generic_metrics",  # will be transactions for a custom one
                "query": "",
                "aggregate": "p75(measurements.cls)",
                "thresholdType": 1,
                "resolveThreshold": None,
                "timeWindow": 60.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294019",
                        "alertRuleId": "177125",
                        "label": "critical",
                        "thresholdType": 1,
                        "alertThreshold": 50.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:52:41.257142Z",
                        "actions": [],
                    }
                ],
                "projects": ["dotnet-aspnetcore"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T23:52:41.231088Z",
                "dateCreated": "2023-09-25T23:52:41.231097Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    CUSTOM_TRANSACTION = [  # this one was avg(transaction.duration)
        OpenApiExample(
            "",
            value={
                "id": "177126",
                "name": "custom metric (avg transaction duration)",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,
                "dataset": "generic_metrics",
                "query": "",
                "aggregate": "avg(transaction.duration)",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 240.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294020",
                        "alertRuleId": "177126",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 856.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:54:53.608833Z",
                        "actions": [],
                    }
                ],
                "projects": ["python"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T23:54:53.553511Z",
                "dateCreated": "2023-09-25T23:54:53.553520Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    CUSTOM_TRANSACTION_CUSTOMP = [
        OpenApiExample(
            "",
            value={
                "id": "177128",
                "name": "custom ttfb custom percentile",
                "organizationId": "4505676595200000",
                "status": 0,
                "queryType": 1,
                "dataset": "transactions",  # thing of note
                "query": "",
                "aggregate": "percentile(measurements.ttfb,0.2)",
                "thresholdType": 0,
                "resolveThreshold": None,
                "timeWindow": 60.0,
                "environment": None,
                "resolution": 1.0,
                "thresholdPeriod": 1,
                "triggers": [
                    {
                        "id": "294022",
                        "alertRuleId": "177128",
                        "label": "critical",
                        "thresholdType": 0,
                        "alertThreshold": 500.0,
                        "resolveThreshold": None,
                        "dateCreated": "2023-09-25T23:59:16.841315Z",
                        "actions": [],
                    }
                ],
                "projects": ["dotnet-aspnetcore"],
                "includeAllProjects": False,
                "owner": "team:4505676595200000",
                "originalAlertRuleId": None,
                "comparisonDelta": None,
                "dateModified": "2023-09-25T23:59:16.774847Z",
                "dateCreated": "2023-09-25T23:59:16.774857Z",
                "createdBy": {
                    "id": 2837708,
                    "name": "Isabella Enriquez",
                    "email": "isabella.enriquez@sentry.io",
                },
            },
        )
    ]

    # NOTE: all custom metric alert rules use the generic_metrics dataset, unless a custom percentile is used (see above)
