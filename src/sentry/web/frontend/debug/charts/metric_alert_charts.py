from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.charts import backend as charts
from sentry.charts.types import ChartType
from sentry.seer.anomaly_detection.types import AnomalyType
from sentry.web.frontend.base import internal_region_silo_view
from sentry.web.frontend.debug.mail import MailPreview

incident = {
    "id": "5903779",
    "identifier": "4445",
    "projects": ["javascript"],
    "activities": [
        {
            "id": "3",
            "incidentIdentifier": "4445",
            "type": 2,
            "value": "20",
            "previousValue": "1",
            "dateCreated": "2022-04-21T20:29:34.982805Z",
        },
        {
            "id": "2",
            "incidentIdentifier": "4445",
            "type": 1,
            "value": None,
            "previousValue": None,
            "dateCreated": "2022-04-21T20:29:34.973137Z",
        },
        {
            "id": "1",
            "incidentIdentifier": "4445",
            "type": 4,
            "value": None,
            "previousValue": None,
            "dateCreated": "2022-04-20T20:28:00Z",
        },
    ],
    "status": 20,
    "statusMethod": 3,
    "type": 2,
    "dateStarted": "2022-04-20T20:28:00Z",
    "dateDetected": "2022-04-21T20:28:00Z",
    "dateCreated": "2022-04-21T20:29:34.963911Z",
    "dateClosed": None,
}

time_series_data = [
    {"name": 1643932800000, "value": 0},
    {"name": 1644019200000, "value": 0},
    {"name": 1644105600000, "value": 0},
    {"name": 1644192000000, "value": 0},
    {"name": 1644278400000, "value": 0},
    {"name": 1644364800000, "value": 0},
    {"name": 1644451200000, "value": 0},
    {"name": 1644537600000, "value": 1},
    {"name": 1644624000000, "value": 0},
    {"name": 1644710400000, "value": 0},
    {"name": 1644796800000, "value": 1},
    {"name": 1644883200000, "value": 0},
    {"name": 1644969600000, "value": 0},
    {"name": 1645056000000, "value": 0},
    {"name": 1645142400000, "value": 0},
    {"name": 1645228800000, "value": 0},
    {"name": 1645315200000, "value": 1},
    {"name": 1645401600000, "value": 0},
    {"name": 1645488000000, "value": 2},
    {"name": 1645574400000, "value": 0},
    {"name": 1645660800000, "value": 0},
    {"name": 1645747200000, "value": 1},
    {"name": 1645833600000, "value": 1},
    {"name": 1645920000000, "value": 0},
    {"name": 1646006400000, "value": 1},
    {"name": 1646092800000, "value": 2},
    {"name": 1646179200000, "value": 1},
    {"name": 1646265600000, "value": 0},
    {"name": 1646352000000, "value": 1},
    {"name": 1646438400000, "value": 0},
    {"name": 1646524800000, "value": 0},
    {"name": 1646611200000, "value": 2},
    {"name": 1646697600000, "value": 0},
    {"name": 1646784000000, "value": 1},
    {"name": 1646870400000, "value": 2},
    {"name": 1646956800000, "value": 1},
    {"name": 1647043200000, "value": 2},
    {"name": 1647129600000, "value": 0},
    {"name": 1647216000000, "value": 0},
    {"name": 1647302400000, "value": 1},
    {"name": 1647388800000, "value": 1},
    {"name": 1647475200000, "value": 0},
    {"name": 1647561600000, "value": 1},
    {"name": 1647648000000, "value": 1},
    {"name": 1647734400000, "value": 0},
    {"name": 1647820800000, "value": 0},
    {"name": 1647907200000, "value": 0},
    {"name": 1647993600000, "value": 0},
    {"name": 1648080000000, "value": 0},
    {"name": 1648166400000, "value": 2},
    {"name": 1648252800000, "value": 1},
    {"name": 1648339200000, "value": 0},
    {"name": 1648425600000, "value": 0},
    {"name": 1648512000000, "value": 0},
    {"name": 1648598400000, "value": 0},
    {"name": 1648684800000, "value": 1},
    {"name": 1648771200000, "value": 0},
    {"name": 1648857600000, "value": 0},
    {"name": 1648944000000, "value": 0},
    {"name": 1649030400000, "value": 0},
    {"name": 1649116800000, "value": 0},
    {"name": 1649203200000, "value": 0},
    {"name": 1649289600000, "value": 1},
    {"name": 1649376000000, "value": 2},
    {"name": 1649462400000, "value": 0},
    {"name": 1649548800000, "value": 0},
    {"name": 1649635200000, "value": 1},
    {"name": 1649721600000, "value": 0},
    {"name": 1649808000000, "value": 0},
    {"name": 1649894400000, "value": 0},
    {"name": 1649980800000, "value": 0},
    {"name": 1650067200000, "value": 0},
    {"name": 1650153600000, "value": 0},
    {"name": 1650240000000, "value": 1},
    {"name": 1650326400000, "value": 3},
    {"name": 1650412800000, "value": 9},
    {"name": 1650499200000, "value": 9},
    {"name": 1650585600000, "value": 20},
    {"name": 1650672000000, "value": 9},
    {"name": 1650758400000, "value": 6},
    {"name": 1650844800000, "value": 8},
    {"name": 1650931200000, "value": 19},
    {"name": 1651017600000, "value": 15},
    {"name": 1651104000000, "value": 18},
    {"name": 1651190400000, "value": 15},
    {"name": 1651276800000, "value": 5},
    {"name": 1651363200000, "value": 5},
    {"name": 1651449600000, "value": 13},
    {"name": 1651536000000, "value": 13},
    {"name": 1651622400000, "value": 11},
    {"name": 1651708800000, "value": 10},
]

detector = {
    "id": "2809079",
    "projectId": "1",
    "name": "Errors in your app!",
    "type": "metric_issue",
    "workflowIds": ["2205787"],
    "owner": {"type": "team", "id": "1869147", "name": "hybrid-meows"},
    "createdBy": "2205443",
    "dateCreated": "2022-04-21T20:29:34.963911Z",
    "dateUpdated": "2022-04-21T20:29:34.963911Z",
    "dataSources": [
        {
            "id": "291216",
            "organizationId": "1",
            "type": "snuba_query_subscription",
            "sourceId": "123456",
            "queryObj": {
                "id": "149426",
                "status": 0,
                "subscription": "55/ab452bfe097c11ef9a4f5e819da55d3b",
                "snubaQuery": {
                    "id": "190380",
                    "dataset": "events",
                    "query": "process_errors",
                    "aggregate": "count()",
                    "timeWindow": 3600,
                    "environment": None,
                    "eventTypes": ["default", "error"],
                },
            },
        }
    ],
    "conditionGroup": {
        "id": "4724332",
        "organizationId": "1",
        "logicType": "any",
        "conditions": [
            {"id": "4228102", "type": "gt", "comparison": 1, "conditionResult": 50},
            {"id": "4228104", "type": "gt", "comparison": 2, "conditionResult": 75},
            {"id": "4228106", "type": "lte", "comparison": 1, "conditionResult": 0},
        ],
        "actions": [],
    },
    "config": {"detectionType": "static", "comparisonDelta": None},
    "enabled": True,
    "alertRuleId": None,
    "ruleId": None,
    "latestGroup": None,
    "openIssues": 0,
}

open_periods = {
    "detector": detector,
    "timeseriesData": [
        {
            "seriesName": "count()",
            "data": time_series_data,
        }
    ],
    "openPeriods": [
        {
            "id": "551505189",  # this ID renders on the vertical line indicating the beginning of an open period
            "start": "2022-04-21T20:29:34.982805Z",
            "end": None,
            "isOpen": True,
            "lastChecked": "2022-05-01T20:28:00Z",
            "activities": [
                {
                    "id": "51146949",
                    "type": "opened",
                    "value": "medium",
                    "dateCreated": "2022-04-21T20:29:34.982805Z",
                }
            ],
        }
    ],
}

metric_alert = {
    "timeseriesData": [
        {
            "seriesName": "count()",
            "data": time_series_data,
        }
    ],
    "rule": {
        "id": "123",
        "name": "Event Failing",
        "status": 0,
        "dataset": "events",
        "query": "issue.id:123",
        "aggregate": "count()",
        "thresholdType": 0,
        "resolveThreshold": 3,
        "timeWindow": 1440,
        "resolution": 1,
        "thresholdPeriod": 1,
        "triggers": [
            {
                "id": "1",
                "alertRuleId": "123",
                "label": "critical",
                "thresholdType": 0,
                "alertThreshold": 8,
                "resolveThreshold": 3,
                "actions": [],
            }
        ],
        "projects": ["javascript"],
        "dateModified": "2022-04-21T20:28:45.581388Z",
        "dateCreated": "2021-03-02T21:00:52.024752Z",
        "eventTypes": ["default"],
    },
    "incidents": [incident],
    "selectedIncident": None,
}
metric_alert_with_anomalies = metric_alert.copy()
metric_alert_with_anomalies["anomalies"] = [
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.NONE.value,
        },
        "timestamp": "2022-04-21T15:30:00Z",
        "value": 0.077881957,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-21T15:40:00Z",
        "value": 0.075652768,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-21T15:41:00Z",
        "value": 0.073435431,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-21T16:42:00Z",
        "value": 0.071145604,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-21T17:43:00Z",
        "value": 0.068080257,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-21T18:44:00Z",
        "value": 0.065966207,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-21T19:45:00Z",
        "value": 0.062053994,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-21T20:46:00Z",
        "value": 0.058596638,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-21T21:47:00Z",
        "value": 0.056028657,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-21T22:48:00Z",
        "value": 0.052905251,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-21T23:49:00Z",
        "value": 0.051122719,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.NONE.value,
        },
        "timestamp": "2022-04-22T00:50:00Z",
        "value": 0.050375953,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.NONE.value,
        },
        "timestamp": "2022-04-22T01:51:00Z",
        "value": 0.047727103,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.NONE.value,
        },
        "timestamp": "2022-04-22T02:52:00Z",
        "value": 0.047437386,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.NONE.value,
        },
        "timestamp": "2022-04-22T03:53:00Z",
        "value": 0.046208149,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-22T04:54:00Z",
        "value": 0.044512145,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-22T05:55:00Z",
        "value": 0.043505737,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-22T06:56:00Z",
        "value": 0.043147801,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-22T07:57:00Z",
        "value": 0.041545758,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-22T08:58:00Z",
        "value": 0.040482494,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
        },
        "timestamp": "2022-04-22T09:59:00Z",
        "value": 0.041155806,
    },
    {
        "anomaly": {
            "anomaly_score": 0,
            "anomaly_type": AnomalyType.NONE.value,
        },
        "timestamp": "2022-04-22T10:60:00Z",
        "value": 0.042155754,
    },
]

crash_free_metric_alert = {
    "sessionResponse": {
        "start": "2022-05-06T13:00:00Z",
        "end": "2022-05-06T19:50:00Z",
        "query": "",
        "intervals": [
            "2022-05-06T13:00:00Z",
            "2022-05-06T14:00:00Z",
            "2022-05-06T15:00:00Z",
            "2022-05-06T16:00:00Z",
            "2022-05-06T17:00:00Z",
            "2022-05-06T18:00:00Z",
            "2022-05-06T19:00:00Z",
        ],
        "groups": [
            {
                "by": {"session.status": "healthy"},
                "totals": {"sum(session)": 212894},
                "series": {"sum(session)": [33118, 40824, 36375, 31771, 28499, 24089, 18218]},
            },
            {
                "by": {"session.status": "errored"},
                "totals": {"sum(session)": 963},
                "series": {"sum(session)": [185, 170, 147, 170, 105, 133, 53]},
            },
            {
                "by": {"session.status": "crashed"},
                "totals": {"sum(session)": 401},
                "series": {"sum(session)": [80, 60, 70, 60, 41, 56, 34]},
            },
            {
                "by": {"session.status": "abnormal"},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0, 0, 0, 0, 0, 0]},
            },
            {
                "by": {"session.status": "unhandled"},
                "totals": {"sum(session)": 0},
                "series": {"sum(session)": [0, 0, 0, 0, 0, 0, 0]},
            },
        ],
    },
    "rule": {
        "id": "234",
        "name": "Crash Free Session Rate LOW",
        "status": 0,
        "dataset": "sessions",
        "query": "",
        "aggregate": "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
        "thresholdType": 1,
        "resolveThreshold": None,
        "timeWindow": 60,
        "resolution": 1,
        "thresholdPeriod": 1,
        "triggers": [
            {
                "id": "1",
                "alertRuleId": "234",
                "label": "critical",
                "thresholdType": 1,
                "alertThreshold": 95,
                "resolveThreshold": None,
                "dateCreated": "2022-02-28T10:41:09.780071Z",
                "actions": [],
            }
        ],
        "projects": ["javascript"],
        "comparisonDelta": None,
        "dateModified": "2022-03-01T13:46:08.699094Z",
        "dateCreated": "2022-02-28T10:41:09.742215Z",
        "eventTypes": ["transaction"],
    },
}


@internal_region_silo_view
class DebugMetricAlertChartRendererView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        ret = []
        ret.append(
            {
                "chart": charts.generate_chart(ChartType.SLACK_METRIC_ALERT_EVENTS, metric_alert),
                "title": "Slack metric alert events",
            }
        )
        ret.append(
            {
                "chart": charts.generate_chart(
                    ChartType.SLACK_METRIC_DETECTOR_EVENTS, open_periods
                ),
                "title": "Slack open period events",
            }
        )
        ret.append(
            {
                "chart": charts.generate_chart(
                    ChartType.SLACK_METRIC_ALERT_SESSIONS, crash_free_metric_alert
                ),
                "title": "Slack metric alert sessions crash free",
            }
        )
        ret.append(
            {
                "chart": charts.generate_chart(
                    ChartType.SLACK_METRIC_ALERT_EVENTS, metric_alert_with_anomalies
                ),
                "title": "Slack metric alert with anomalies",
            }
        )

        return MailPreview(
            html_template="sentry/debug/chart-renderer.html",
            text_template="sentry/debug/chart-renderer.txt",
            context={"charts": ret},
        ).render(request)
