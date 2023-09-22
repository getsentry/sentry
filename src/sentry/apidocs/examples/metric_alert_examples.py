from drf_spectacular.utils import OpenApiExample


class MetricAlertExamples:
    LIST_METRIC_ALERT_RULES = [
        OpenApiExample(
            "List metric alert rules for an organization",
            value=[
                {
                    "id": "7",
                    "name": "My Metric Alert",
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
                    "thresholdPeriod": 100,
                    "eventTypes": ["error"],
                }
            ],
        )
    ]
