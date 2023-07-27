from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.charts import backend as charts
from sentry.charts.types import ChartType
from sentry.web.helpers import render_to_response

discover_total_period = {
    "seriesName": "Discover total period",
    "stats": {
        "data": [
            [1616168400, [{"count": 0}]],
            [1616168700, [{"count": 12}]],
            [1616169000, [{"count": 13}]],
            [1616169300, [{"count": 9}]],
            [1616169600, [{"count": 12}]],
            [1616169900, [{"count": 21}]],
            [1616170200, [{"count": 11}]],
            [1616170500, [{"count": 22}]],
            [1616170800, [{"count": 18}]],
            [1616171100, [{"count": 15}]],
            [1616171400, [{"count": 14}]],
            [1616171700, [{"count": 31}]],
            [1616172000, [{"count": 18}]],
            [1616172300, [{"count": 13}]],
            [1616172600, [{"count": 17}]],
            [1616172900, [{"count": 9}]],
            [1616173200, [{"count": 9}]],
            [1616173500, [{"count": 13}]],
            [1616173800, [{"count": 11}]],
        ],
    },
}

discover_geo = {
    "seriesName": "Discover total period",
    "stats": {
        "data": [
            {"geo.country_code": "US", "count": 1},
            {"geo.country_code": "GB", "count": 30},
            {"geo.country_code": "AU", "count": 20},
        ],
    },
}

discover_total_daily = {
    "seriesName": "Discover total daily",
    "stats": {
        "data": [
            [1615852800, [{"count": 2426486}]],
            [1615939200, [{"count": 18837228}]],
            [1616025600, [{"count": 14662530}]],
            [1616112000, [{"count": 15102981}]],
            [1616198400, [{"count": 7759228}]],
            [1616284800, [{"count": 7216556}]],
            [1616371200, [{"count": 16976035}]],
            [1616457600, [{"count": 17240832}]],
            [1616544000, [{"count": 16814701}]],
            [1616630400, [{"count": 17480989}]],
            [1616716800, [{"count": 15387478}]],
            [1616803200, [{"count": 8467454}]],
            [1616889600, [{"count": 6382678}]],
            [1616976000, [{"count": 16842851}]],
            [1617062400, [{"count": 12959057}]],
        ],
    },
}

discover_total_daily_multi = {
    "seriesName": "Discover total daily",
    "stats": {
        "count()": {
            "data": [
                [1615852800, [{"count": 2426486}]],
                [1615939200, [{"count": 18837228}]],
                [1616025600, [{"count": 14662530}]],
                [1616112000, [{"count": 15102981}]],
                [1616198400, [{"count": 7759228}]],
                [1616284800, [{"count": 7216556}]],
                [1616371200, [{"count": 16976035}]],
                [1616457600, [{"count": 17240832}]],
                [1616544000, [{"count": 16814701}]],
                [1616630400, [{"count": 17480989}]],
                [1616716800, [{"count": 15387478}]],
                [1616803200, [{"count": 8467454}]],
                [1616889600, [{"count": 6382678}]],
                [1616976000, [{"count": 16842851}]],
                [1617062400, [{"count": 12959057}]],
            ],
        },
        "count_unique(user)": {
            "data": [
                [1615852800, [{"count": 242648}]],
                [1615939200, [{"count": 1883722}]],
                [1616025600, [{"count": 1466253}]],
                [1616112000, [{"count": 5102981}]],
                [1616198400, [{"count": 759228}]],
                [1616284800, [{"count": 216556}]],
                [1616371200, [{"count": 6976035}]],
                [1616457600, [{"count": 7240832}]],
                [1616544000, [{"count": 1681470}]],
                [1616630400, [{"count": 1748098}]],
                [1616716800, [{"count": 1538747}]],
                [1616803200, [{"count": 846745}]],
                [1616889600, [{"count": 382678}]],
                [1616976000, [{"count": 6842851}]],
                [1617062400, [{"count": 2959057}]],
            ],
        },
    },
}

discover_multi_y_axis = {
    "seriesName": "count()",
    "stats": {
        "count()": {
            "data": [
                (1631559900, [{"count": 5}]),
                (1631560200, [{"count": 8}]),
                (1631560500, [{"count": 10}]),
                (1631560800, [{"count": 10}]),
                (1631561100, [{"count": 6}]),
                (1631561400, [{"count": 5}]),
                (1631561700, [{"count": 7}]),
                (1631562000, [{"count": 5}]),
                (1631562300, [{"count": 6}]),
                (1631562600, [{"count": 4}]),
                (1631562900, [{"count": 8}]),
                (1631563200, [{"count": 5}]),
                (1631563500, [{"count": 5}]),
                (1631563800, [{"count": 7}]),
                (1631564100, [{"count": 5}]),
                (1631564400, [{"count": 9}]),
                (1631564700, [{"count": 5}]),
            ],
            "end": "1631646300",
            "order": "1",
            "start": "1631559900",
        },
        "count_unique(user)": {
            "data": [
                (1631559900, [{"count": 0}]),
                (1631560200, [{"count": 2}]),
                (1631560500, [{"count": 3}]),
                (1631560800, [{"count": 1}]),
                (1631561100, [{"count": 1}]),
                (1631561400, [{"count": 0}]),
                (1631561700, [{"count": 1}]),
                (1631562000, [{"count": 0}]),
                (1631562300, [{"count": 1}]),
                (1631562600, [{"count": 0}]),
                (1631562900, [{"count": 1}]),
                (1631563200, [{"count": 0}]),
                (1631563500, [{"count": 0}]),
                (1631563800, [{"count": 1}]),
                (1631564100, [{"count": 0}]),
                (1631564400, [{"count": 1}]),
                (1631564700, [{"count": 0}]),
            ],
            "end": "1631646300",
            "order": "0",
            "start": "1631559900",
        },
    },
}

discover_top5 = {
    "stats": {
        "ludic-science,1st event": {
            "data": [
                [1615877940, [{"count": 0}]],
                [1615878000, [{"count": 0}]],
                [1615878060, [{"count": 0}]],
                [1615878120, [{"count": 0}]],
                [1615878180, [{"count": 1}]],
                [1615878240, [{"count": 1}]],
                [1615878300, [{"count": 1}]],
                [1615878360, [{"count": 1}]],
                [1615878420, [{"count": 1}]],
                [1615878480, [{"count": 1}]],
                [1615878540, [{"count": 1}]],
                [1615878600, [{"count": 3}]],
                [1615878660, [{"count": 1}]],
                [1615878720, [{"count": 1}]],
                [1615878780, [{"count": 1}]],
                [1615878840, [{"count": 1}]],
                [1615878900, [{"count": 1}]],
                [1615878960, [{"count": 1}]],
                [1615879020, [{"count": 1}]],
                [1615879080, [{"count": 1}]],
                [1615879140, [{"count": 1}]],
                [1615879200, [{"count": 1}]],
                [1615879260, [{"count": 1}]],
                [1615879320, [{"count": 1}]],
                [1615879380, [{"count": 0}]],
                [1615879440, [{"count": 0}]],
                [1615879500, [{"count": 0}]],
                [1615879560, [{"count": 0}]],
                [1615879620, [{"count": 0}]],
            ],
            "order": 0,
        },
        "ludic-science,2nd event": {
            "data": [
                [1615877940, [{"count": 0}]],
                [1615878000, [{"count": 0}]],
                [1615878060, [{"count": 0}]],
                [1615878120, [{"count": 0}]],
                [1615878180, [{"count": 1}]],
                [1615878240, [{"count": 1}]],
                [1615878300, [{"count": 1}]],
                [1615878360, [{"count": 1}]],
                [1615878420, [{"count": 1}]],
                [1615878480, [{"count": 1}]],
                [1615878540, [{"count": 1}]],
                [1615878600, [{"count": 5}]],
                [1615878660, [{"count": 3}]],
                [1615878720, [{"count": 2}]],
                [1615878780, [{"count": 1}]],
                [1615878840, [{"count": 1}]],
                [1615878900, [{"count": 1}]],
                [1615878960, [{"count": 1}]],
                [1615879020, [{"count": 1}]],
                [1615879080, [{"count": 1}]],
                [1615879140, [{"count": 1}]],
                [1615879200, [{"count": 1}]],
                [1615879260, [{"count": 1}]],
                [1615879320, [{"count": 1}]],
                [1615879380, [{"count": 0}]],
                [1615879440, [{"count": 0}]],
                [1615879500, [{"count": 0}]],
                [1615879560, [{"count": 0}]],
                [1615879620, [{"count": 0}]],
            ],
            "order": 1,
        },
        "Other": {
            "data": [
                [1615877940, [{"count": 2}]],
                [1615878000, [{"count": 2}]],
                [1615878060, [{"count": 2}]],
                [1615878120, [{"count": 2}]],
                [1615878180, [{"count": 0}]],
                [1615878240, [{"count": 0}]],
                [1615878300, [{"count": 0}]],
                [1615878360, [{"count": 0}]],
                [1615878420, [{"count": 0}]],
                [1615878480, [{"count": 1}]],
                [1615878540, [{"count": 2}]],
                [1615878600, [{"count": 5}]],
                [1615878660, [{"count": 3}]],
                [1615878720, [{"count": 2}]],
                [1615878780, [{"count": 1}]],
                [1615878840, [{"count": 0}]],
                [1615878900, [{"count": 0}]],
                [1615878960, [{"count": 0}]],
                [1615879020, [{"count": 0}]],
                [1615879080, [{"count": 0}]],
                [1615879140, [{"count": 0}]],
                [1615879200, [{"count": 0}]],
                [1615879260, [{"count": 0}]],
                [1615879320, [{"count": 0}]],
                [1615879380, [{"count": 2}]],
                [1615879440, [{"count": 2}]],
                [1615879500, [{"count": 2}]],
                [1615879560, [{"count": 2}]],
                [1615879620, [{"count": 2}]],
            ],
            "order": 2,
        },
    }
}

discover_empty = {
    "seriesName": "Discover empty",
    "stats": {
        "data": [],
    },
}

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

metric_alert = {
    "timeseriesData": [
        {
            "seriesName": "count()",
            "data": [
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
            ],
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


class DebugChartRendererView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        ret = []

        ret.append(
            charts.generate_chart(ChartType.SLACK_DISCOVER_TOTAL_PERIOD, discover_total_period)
        )
        ret.append(
            charts.generate_chart(ChartType.SLACK_DISCOVER_TOTAL_PERIOD, discover_multi_y_axis)
        )
        ret.append(charts.generate_chart(ChartType.SLACK_DISCOVER_TOTAL_PERIOD, discover_empty))
        ret.append(
            charts.generate_chart(ChartType.SLACK_DISCOVER_TOTAL_DAILY, discover_total_daily)
        )
        ret.append(
            charts.generate_chart(ChartType.SLACK_DISCOVER_TOTAL_DAILY, discover_total_daily_multi)
        )
        ret.append(charts.generate_chart(ChartType.SLACK_DISCOVER_TOTAL_DAILY, discover_empty))
        ret.append(charts.generate_chart(ChartType.SLACK_DISCOVER_TOP5_PERIOD, discover_top5))
        ret.append(charts.generate_chart(ChartType.SLACK_DISCOVER_TOP5_PERIOD, discover_empty))
        ret.append(charts.generate_chart(ChartType.SLACK_DISCOVER_TOP5_PERIOD_LINE, discover_top5))
        ret.append(charts.generate_chart(ChartType.SLACK_DISCOVER_TOP5_PERIOD_LINE, discover_empty))
        ret.append(charts.generate_chart(ChartType.SLACK_DISCOVER_TOP5_DAILY, discover_top5))
        ret.append(charts.generate_chart(ChartType.SLACK_DISCOVER_TOP5_DAILY, discover_empty))
        ret.append(
            charts.generate_chart(ChartType.SLACK_DISCOVER_PREVIOUS_PERIOD, discover_total_period)
        )
        ret.append(
            charts.generate_chart(ChartType.SLACK_DISCOVER_PREVIOUS_PERIOD, discover_multi_y_axis)
        )

        ret.append(charts.generate_chart(ChartType.SLACK_METRIC_ALERT_EVENTS, metric_alert))
        ret.append(
            charts.generate_chart(ChartType.SLACK_METRIC_ALERT_SESSIONS, crash_free_metric_alert)
        )

        return render_to_response("sentry/debug/chart-renderer.html", context={"charts": ret})
