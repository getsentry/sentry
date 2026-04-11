from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.http.request import QueryDict
from django.test import RequestFactory
from django.utils import timezone

from sentry.charts.types import ChartType
from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.integrations.slack.message_builder.discover import SlackDiscoverMessageBuilder
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.integrations.slack.message_builder.metric_alerts import SlackMetricAlertMessageBuilder
from sentry.integrations.slack.unfurl.handlers import link_handlers, match_link
from sentry.integrations.slack.unfurl.types import LinkType, UnfurlableUrl
from sentry.search.eap.types import SupportedTraceItemType
from sentry.snuba import discover, errors, transactions
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQueryEventType
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.spans_rpc import Spans
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba, pytest.mark.sentry_metrics]

INTERVAL_COUNT = 300
INTERVALS_PER_DAY = int(60 * 60 * 24 / INTERVAL_COUNT)


@pytest.mark.parametrize(
    "url,expected",
    [
        ("http://invalid_link", (None, None)),
        (
            "https://sentry.io/organizations/org1/issues/12345/",
            (LinkType.ISSUES, {"issue_id": 12345, "event_id": None}),
        ),
        (
            "https://org1.sentry.io/issues/12345/",
            (LinkType.ISSUES, {"issue_id": 12345, "event_id": None}),
        ),
        (
            "https://sentry.io/organizations/org1/alerts/rules/details/12345/",
            (None, None),
        ),
        (
            "https://org1.sentry.io/alerts/rules/details/12345/",
            (None, None),
        ),
        (
            "https://sentry.io/organizations/org1/issues/alerts/rules/details/12345/",
            (
                LinkType.METRIC_ALERT,
                {
                    "alert_rule_id": 12345,
                    "incident_id": None,
                    "org_slug": "org1",
                    "period": None,
                    "start": None,
                    "end": None,
                },
            ),
        ),
        (
            "https://org1.sentry.io/issues/alerts/rules/details/12345/",
            (
                LinkType.METRIC_ALERT,
                {
                    "alert_rule_id": 12345,
                    "incident_id": None,
                    "org_slug": "org1",
                    "period": None,
                    "start": None,
                    "end": None,
                },
            ),
        ),
        (
            "https://sentry.io/organizations/org1/issues/alerts/rules/details/12345/?alert=1337",
            (
                LinkType.METRIC_ALERT,
                {
                    "alert_rule_id": 12345,
                    "incident_id": 1337,
                    "org_slug": "org1",
                    "period": None,
                    "start": None,
                    "end": None,
                },
            ),
        ),
        (
            "https://org1.sentry.io/issues/alerts/rules/details/12345/?alert=1337",
            (
                LinkType.METRIC_ALERT,
                {
                    "alert_rule_id": 12345,
                    "incident_id": 1337,
                    "org_slug": "org1",
                    "period": None,
                    "start": None,
                    "end": None,
                },
            ),
        ),
        (
            "https://sentry.io/organizations/org1/issues/alerts/rules/details/12345/?period=14d",
            (
                LinkType.METRIC_ALERT,
                {
                    "alert_rule_id": 12345,
                    "incident_id": None,
                    "org_slug": "org1",
                    "period": "14d",
                    "start": None,
                    "end": None,
                },
            ),
        ),
        (
            "https://org1.sentry.io/issues/alerts/rules/details/12345/?period=14d",
            (
                LinkType.METRIC_ALERT,
                {
                    "alert_rule_id": 12345,
                    "incident_id": None,
                    "org_slug": "org1",
                    "period": "14d",
                    "start": None,
                    "end": None,
                },
            ),
        ),
        (
            "https://sentry.io/organizations/org1/issues/alerts/rules/details/12345/?end=2022-05-05T06%3A05%3A52&start=2022-05-04T00%3A46%3A19",
            (
                LinkType.METRIC_ALERT,
                {
                    "alert_rule_id": 12345,
                    "incident_id": None,
                    "org_slug": "org1",
                    "period": None,
                    "start": "2022-05-04T00:46:19",
                    "end": "2022-05-05T06:05:52",
                },
            ),
        ),
        (
            "https://org1.sentry.io/issues/alerts/rules/details/12345/?end=2022-05-05T06%3A05%3A52&start=2022-05-04T00%3A46%3A19",
            (
                LinkType.METRIC_ALERT,
                {
                    "alert_rule_id": 12345,
                    "incident_id": None,
                    "org_slug": "org1",
                    "period": None,
                    "start": "2022-05-04T00:46:19",
                    "end": "2022-05-05T06:05:52",
                },
            ),
        ),
        (
            "https://sentry.io/organizations/org1/discover/results/?project=1&yAxis=count()",
            (
                LinkType.DISCOVER,
                {"org_slug": "org1", "query": QueryDict("project=1&yAxis=count()")},
            ),
        ),
        (
            "https://org1.sentry.io/discover/results/?project=1&yAxis=count()",
            (
                LinkType.DISCOVER,
                {"org_slug": "org1", "query": QueryDict("project=1&yAxis=count()")},
            ),
        ),
        (
            "https://sentry.io/organizations/org1/explore/discover/results/?project=1&yAxis=count()",
            (
                LinkType.DISCOVER,
                {"org_slug": "org1", "query": QueryDict("project=1&yAxis=count()")},
            ),
        ),
        (
            "https://org1.sentry.io/explore/discover/results/?project=1&yAxis=count()",
            (
                LinkType.DISCOVER,
                {"org_slug": "org1", "query": QueryDict("project=1&yAxis=count()")},
            ),
        ),
        (
            "https://sentry.io/organizations/org1/explore/traces/?aggregateField=%7B%22groupBy%22%3A%22%22%7D&aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D&project=1&statsPeriod=24h",
            (
                LinkType.EXPLORE,
                {
                    "org_slug": "org1",
                    "query": QueryDict("yAxis=avg(span.duration)&project=1&statsPeriod=24h"),
                    "chart_type": None,
                    "dataset": SupportedTraceItemType.SPANS,
                },
            ),
        ),
        (
            "https://org1.sentry.io/explore/traces/?aggregateField=%7B%22yAxes%22%3A%5B%22count(span.duration)%22%5D%7D&statsPeriod=24h",
            (
                LinkType.EXPLORE,
                {
                    "org_slug": "org1",
                    "query": QueryDict("yAxis=count(span.duration)&statsPeriod=24h"),
                    "chart_type": None,
                    "dataset": SupportedTraceItemType.SPANS,
                },
            ),
        ),
        (
            "https://sentry.io/organizations/org1/explore/logs/?aggregateField=%7B%22yAxes%22%3A%5B%22sum(payload_size)%22%5D%7D&project=1&statsPeriod=24h",
            (
                LinkType.EXPLORE,
                {
                    "org_slug": "org1",
                    "query": QueryDict("yAxis=sum(payload_size)&project=1&statsPeriod=24h"),
                    "chart_type": None,
                    "dataset": SupportedTraceItemType.LOGS,
                },
            ),
        ),
        (
            "https://org1.sentry.io/explore/logs/?aggregateField=%7B%22yAxes%22%3A%5B%22count(payload_size)%22%5D%7D&statsPeriod=24h",
            (
                LinkType.EXPLORE,
                {
                    "org_slug": "org1",
                    "query": QueryDict("yAxis=count(payload_size)&statsPeriod=24h"),
                    "chart_type": None,
                    "dataset": SupportedTraceItemType.LOGS,
                },
            ),
        ),
    ],
)
def test_match_link(url, expected) -> None:
    assert match_link(url) == expected


class UnfurlTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        # We're redefining project to ensure that the individual tests have unique project ids.
        # Sharing project ids across tests could result in some race conditions
        self.project = self.create_project()
        self._integration = install_slack(self.organization)
        self.integration = serialize_integration(self._integration)

        self.request = RequestFactory().get("slack/event")
        self.frozen_time = freeze_time(datetime.now() - timedelta(days=1))
        self.frozen_time.start()

    def tearDown(self) -> None:
        self.frozen_time.stop()

    def test_unfurl_issues(self) -> None:
        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )
        assert event.group is not None
        group2 = event.group

        links = [
            UnfurlableUrl(
                url=f"https://sentry.io/organizations/{self.organization.slug}/issues/{self.group.id}/",
                args={"issue_id": self.group.id, "event_id": None},
            ),
            UnfurlableUrl(
                url=f"https://sentry.io/organizations/{self.organization.slug}/issues/{group2.id}/{event.event_id}/",
                args={"issue_id": group2.id, "event_id": event.event_id},
            ),
        ]

        unfurls = link_handlers[LinkType.ISSUES].fn(self.integration, links)

        assert unfurls[links[0].url] == SlackIssuesMessageBuilder(self.group).build()
        assert (
            unfurls[links[1].url]
            == SlackIssuesMessageBuilder(
                group2, event.for_group(group2), link_to_event=True
            ).build()
        )

    def test_unfurl_issues_block_kit(self) -> None:
        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )
        assert event.group is not None
        group2 = event.group

        links = [
            UnfurlableUrl(
                url=f"https://sentry.io/organizations/{self.organization.slug}/issues/{self.group.id}/",
                args={"issue_id": self.group.id, "event_id": None},
            ),
            UnfurlableUrl(
                url=f"https://sentry.io/organizations/{self.organization.slug}/issues/{group2.id}/{event.event_id}/",
                args={"issue_id": group2.id, "event_id": event.event_id},
            ),
        ]

        unfurls = link_handlers[LinkType.ISSUES].fn(self.integration, links)

        assert unfurls[links[0].url] == SlackIssuesMessageBuilder(self.group).build()
        assert (
            unfurls[links[1].url]
            == SlackIssuesMessageBuilder(
                group2, event.for_group(group2), link_to_event=True
            ).build()
        )

    def test_escape_issue(self) -> None:
        # wraps text in markdown code block
        escape_text = "<https://example.com/|*Click Here*>"
        group = self.create_group(
            project=self.project,
            data={"type": "error", "metadata": {"value": escape_text}},
        )

        links = [
            UnfurlableUrl(
                url=f"https://sentry.io/organizations/{self.organization.slug}/issues/{group.id}/",
                args={"issue_id": group.id, "event_id": None},
            ),
        ]

        unfurls = link_handlers[LinkType.ISSUES].fn(self.integration, links)
        assert unfurls[links[0].url]["blocks"][1]["text"]["text"] == "```" + escape_text + "```"

    def test_unfurl_metric_alert(self) -> None:
        alert_rule = self.create_alert_rule()

        incident = self.create_incident(
            status=2, organization=self.organization, projects=[self.project], alert_rule=alert_rule
        )
        incident.update(identifier=123)
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )

        links = [
            UnfurlableUrl(
                url=f"https://sentry.io/organizations/{self.organization.slug}/issues/alerts/rules/details/{incident.alert_rule.id}/?alert={incident.identifier}",
                args={
                    "org_slug": self.organization.slug,
                    "alert_rule_id": incident.alert_rule.id,
                    "incident_id": incident.identifier,
                    "period": None,
                    "start": None,
                    "end": None,
                },
            ),
        ]
        unfurls = link_handlers[LinkType.METRIC_ALERT].fn(self.integration, links)
        assert (
            links[0].url
            == f"https://sentry.io/organizations/{self.organization.slug}/issues/alerts/rules/details/{incident.alert_rule.id}/?alert={incident.identifier}"
        )
        assert (
            unfurls[links[0].url]
            == SlackMetricAlertMessageBuilder(incident.alert_rule, incident).build()
        )

    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_metric_alerts_chart(self, mock_generate_chart: MagicMock) -> None:
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(
            status=2,
            organization=self.organization,
            projects=[self.project],
            alert_rule=alert_rule,
            date_started=timezone.now() - timedelta(minutes=2),
        )
        incident.update(identifier=123)
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/issues/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}"
        links = [
            UnfurlableUrl(
                url=url,
                args={
                    "org_slug": self.organization.slug,
                    "alert_rule_id": alert_rule.id,
                    "incident_id": incident.identifier,
                    "period": None,
                    "start": None,
                    "end": None,
                },
            ),
        ]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:discover",
                "organizations:discover-basic",
                "organizations:metric-alert-chartcuterie",
            ]
        ):
            unfurls = link_handlers[LinkType.METRIC_ALERT].fn(self.integration, links)

        assert (
            unfurls[links[0].url]
            == SlackMetricAlertMessageBuilder(alert_rule, incident, chart_url="chart-url").build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["rule"]["id"] == str(alert_rule.id)
        assert chart_data["selectedIncident"]["identifier"] == str(incident.identifier)
        series_data = chart_data["timeseriesData"][0]["data"]
        assert len(series_data) > 0
        # Validate format of timeseries
        assert type(series_data[0]["name"]) is int
        assert type(series_data[0]["value"]) is float
        assert chart_data["incidents"][0]["id"] == str(incident.id)

    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_metric_alerts_chart_transaction(self, mock_generate_chart: MagicMock) -> None:
        # Using the transactions dataset
        alert_rule = self.create_alert_rule(query="p95", dataset=Dataset.Transactions)
        incident = self.create_incident(
            status=2,
            organization=self.organization,
            projects=[self.project],
            alert_rule=alert_rule,
            date_started=timezone.now() - timedelta(minutes=2),
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/issues/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}"
        links = [
            UnfurlableUrl(
                url=url,
                args={
                    "org_slug": self.organization.slug,
                    "alert_rule_id": alert_rule.id,
                    "incident_id": incident.identifier,
                    "period": None,
                    "start": None,
                    "end": None,
                },
            ),
        ]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:discover",
                "organizations:performance-view",
                "organizations:metric-alert-chartcuterie",
            ]
        ):
            unfurls = link_handlers[LinkType.METRIC_ALERT].fn(self.integration, links)

        assert (
            unfurls[links[0].url]
            == SlackMetricAlertMessageBuilder(alert_rule, incident, chart_url="chart-url").build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["rule"]["id"] == str(alert_rule.id)
        assert chart_data["selectedIncident"]["identifier"] == str(incident.identifier)
        series_data = chart_data["timeseriesData"][0]["data"]
        assert len(series_data) > 0
        # Validate format of timeseries
        assert type(series_data[0]["name"]) is int
        assert type(series_data[0]["value"]) is float
        assert chart_data["incidents"][0]["id"] == str(incident.id)

    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_metric_alerts_chart_eap_spans(self, mock_generate_chart: MagicMock) -> None:
        # Using the EventsAnalyticsPlatform dataset
        alert_rule = self.create_alert_rule(
            query="span.op:foo", dataset=Dataset.EventsAnalyticsPlatform
        )
        incident = self.create_incident(
            status=2,
            organization=self.organization,
            projects=[self.project],
            alert_rule=alert_rule,
            date_started=timezone.now() - timedelta(minutes=2),
        )
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/issues/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}"
        links = [
            UnfurlableUrl(
                url=url,
                args={
                    "org_slug": self.organization.slug,
                    "alert_rule_id": alert_rule.id,
                    "incident_id": incident.identifier,
                    "period": None,
                    "start": None,
                    "end": None,
                },
            ),
        ]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:discover",
                "organizations:performance-view",
                "organizations:metric-alert-chartcuterie",
            ]
        ):
            unfurls = link_handlers[LinkType.METRIC_ALERT].fn(self.integration, links)

        assert (
            unfurls[links[0].url]
            == SlackMetricAlertMessageBuilder(alert_rule, incident, chart_url="chart-url").build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["rule"]["id"] == str(alert_rule.id)
        assert chart_data["rule"]["dataset"] == "events_analytics_platform"
        assert chart_data["selectedIncident"]["identifier"] == str(incident.identifier)
        series_data = chart_data["timeseriesData"][0]["data"]
        assert len(series_data) > 0
        # Validate format of timeseries
        assert type(series_data[0]["name"]) is int
        assert type(series_data[0]["value"]) is float
        assert chart_data["incidents"][0]["id"] == str(incident.id)

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_metric_alerts_chart_eap_spans_events_stats_call(
        self, mock_generate_chart, mock_get_event_stats_data
    ):
        # Using the EventsAnalyticsPlatform dataset
        alert_rule = self.create_alert_rule(
            query="span.op:foo", dataset=Dataset.EventsAnalyticsPlatform
        )
        incident = self.create_incident(
            status=2,
            organization=self.organization,
            projects=[self.project],
            alert_rule=alert_rule,
            date_started=timezone.now() - timedelta(minutes=2),
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/issues/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}"
        links = [
            UnfurlableUrl(
                url=url,
                args={
                    "org_slug": self.organization.slug,
                    "alert_rule_id": alert_rule.id,
                    "incident_id": incident.identifier,
                    "period": None,
                    "start": None,
                    "end": None,
                },
            ),
        ]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:discover",
                "organizations:performance-view",
                "organizations:metric-alert-chartcuterie",
            ]
        ):
            link_handlers[LinkType.METRIC_ALERT].fn(self.integration, links)

        dataset = mock_get_event_stats_data.mock_calls[0][2]["dataset"]
        assert dataset == Spans

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_metric_alerts_chart_eap_ourlogs_events_stats_call(
        self, mock_generate_chart, mock_get_event_stats_data
    ):
        # Using the EventsAnalyticsPlatform dataset with TRACE_ITEM_LOG event type
        alert_rule = self.create_alert_rule(
            query="log.level:error",
            dataset=Dataset.EventsAnalyticsPlatform,
            event_types=[SnubaQueryEventType.EventType.TRACE_ITEM_LOG],
        )
        incident = self.create_incident(
            status=2,
            organization=self.organization,
            projects=[self.project],
            alert_rule=alert_rule,
            date_started=timezone.now() - timedelta(minutes=2),
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/issues/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}"
        links = [
            UnfurlableUrl(
                url=url,
                args={
                    "org_slug": self.organization.slug,
                    "alert_rule_id": alert_rule.id,
                    "incident_id": incident.identifier,
                    "period": None,
                    "start": None,
                    "end": None,
                },
            ),
        ]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:discover",
                "organizations:performance-view",
                "organizations:metric-alert-chartcuterie",
            ]
        ):
            link_handlers[LinkType.METRIC_ALERT].fn(self.integration, links)

        dataset = mock_get_event_stats_data.mock_calls[0][2]["dataset"]
        assert dataset == OurLogs

    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_metric_alerts_chart_crash_free(self, mock_generate_chart: MagicMock) -> None:
        alert_rule = self.create_alert_rule(
            query="",
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            dataset=Dataset.Metrics,
            time_window=60,
            resolve_threshold=10,
            threshold_period=1,
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/issues/alerts/rules/details/{alert_rule.id}/"
        links = [
            UnfurlableUrl(
                url=url,
                args={
                    "org_slug": self.organization.slug,
                    "alert_rule_id": alert_rule.id,
                    "incident_id": None,
                    "period": None,
                    "start": None,
                    "end": None,
                },
            ),
        ]

        with self.feature(
            [
                "organizations:incidents",
                "organizations:discover",
                "organizations:discover-basic",
                "organizations:metric-alert-chartcuterie",
            ]
        ):
            unfurls = link_handlers[LinkType.METRIC_ALERT].fn(self.integration, links)

        assert (
            unfurls[links[0].url]
            == SlackMetricAlertMessageBuilder(alert_rule, chart_url="chart-url").build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["rule"]["id"] == str(alert_rule.id)
        assert chart_data["selectedIncident"] is None
        assert len(chart_data["sessionResponse"]["groups"]) >= 1
        assert len(chart_data["incidents"]) == 0

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
        return_value={
            "data": [(i * INTERVAL_COUNT, [{"count": 0}]) for i in range(INTERVALS_PER_DAY)],
            "end": 1652903400,
            "isMetricsData": False,
            "start": 1652817000,
        },
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_discover(self, mock_generate_chart: MagicMock, _: MagicMock) -> None:
        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&project={self.project.id}&query=&sort=-timestamp&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:discover-basic"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count()"
        assert len(chart_data["stats"]["data"]) == INTERVALS_PER_DAY

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
        return_value={
            "data": [
                (i * INTERVAL_COUNT, [{"count": 0}]) for i in range(int(INTERVALS_PER_DAY / 6))
            ],
            "end": 1652903400,
            "isMetricsData": False,
            "start": 1652817000,
        },
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_discover_previous_period(
        self, mock_generate_chart: MagicMock, _: MagicMock
    ) -> None:
        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?display=previous&field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&project={self.project.id}&query=&sort=-timestamp&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:discover-basic"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_DISCOVER_PREVIOUS_PERIOD
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count()"
        assert len(chart_data["stats"]["data"]) == 48

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
        return_value={
            "count()": {
                "data": [(i * INTERVAL_COUNT, [{"count": 0}]) for i in range(INTERVALS_PER_DAY)],
                "end": 1652903400,
                "isMetricsData": False,
                "order": 1,
                "start": 1652817000,
            },
            "count_unique(user)": {
                "data": [(i * INTERVAL_COUNT, [{"count": 0}]) for i in range(INTERVALS_PER_DAY)],
                "end": 1652903400,
                "isMetricsData": False,
                "order": 1,
                "start": 1652817000,
            },
        },
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_discover_multi_y_axis(
        self, mock_generate_chart: MagicMock, _: MagicMock
    ) -> None:
        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&project={self.project.id}&query=&sort=-timestamp&statsPeriod=24h&yAxis=count_unique%28user%29&yAxis=count%28%29"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:discover-basic"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]

        assert len(chart_data["stats"]["count()"]["data"]) == INTERVALS_PER_DAY
        assert len(chart_data["stats"]["count_unique(user)"]["data"]) == INTERVALS_PER_DAY

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
        return_value={
            "data": [(i * INTERVAL_COUNT, [{"count": 0}]) for i in range(INTERVALS_PER_DAY)],
            "end": 1652903400,
            "isMetricsData": False,
            "start": 1652817000,
        },
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_discover_html_escaped(
        self, mock_generate_chart: MagicMock, _: MagicMock
    ) -> None:
        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?field=title&amp;field=event.type&amp;field=project&amp;field=user.display&amp;field=timestamp&amp;name=All+Events&amp;project={self.project.id}&amp;query=&amp;sort=-timestamp&amp;statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:discover-basic"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count()"
        assert len(chart_data["stats"]["data"]) == INTERVALS_PER_DAY

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
        return_value={
            "default,first,capable-hagfish,None": {
                "data": [(i * INTERVAL_COUNT, [{"count": 0}]) for i in range(INTERVALS_PER_DAY)],
                "end": 1652903400,
                "isMetricsData": False,
                "order": 1,
                "start": 1652817000,
            },
            "default,second,capable-hagfish,None": {
                "data": [(i * INTERVAL_COUNT, [{"count": 0}]) for i in range(INTERVALS_PER_DAY)],
                "end": 1652903400,
                "isMetricsData": False,
                "order": 1,
                "start": 1652817000,
            },
        },
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_discover_short_url(self, mock_generate_chart: MagicMock, _: MagicMock) -> None:
        query = {
            "fields": ["message", "event.type", "project", "user.display", "count_unique(user)"],
            "query": "message:[first,second]",
            "yAxis": "count_unique(user)",
            "display": "top5",
            "topEvents": 2,
        }
        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.organization,
            created_by_id=self.user.id,
            name="Test query",
            query=query,
            version=2,
        )
        saved_query.set_projects([self.project.id])

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?id={saved_query.id}&statsPeriod=24h&project={self.project.id}"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1

        # Line chart expected since yAxis is count_unique(user)
        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_DISCOVER_TOP5_PERIOD_LINE
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count_unique(user)"
        # 2 + 1 cause of Other
        assert len(chart_data["stats"].keys()) == 2
        first_key = list(chart_data["stats"].keys())[0]
        assert len(chart_data["stats"][first_key]["data"]) == INTERVALS_PER_DAY

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
        return_value={
            "data": [(i * INTERVAL_COUNT, [{"count": 0}]) for i in range(INTERVALS_PER_DAY)],
            "end": 1652903400,
            "isMetricsData": False,
            "start": 1652817000,
        },
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_correct_y_axis_for_saved_query(
        self, mock_generate_chart: MagicMock, _: MagicMock
    ) -> None:
        query = {
            "fields": [
                "message",
                "event.type",
                "project",
                "user.display",
                "p50(transaction.duration)",
            ],
        }
        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.organization,
            created_by_id=self.user.id,
            name="Test query",
            query=query,
            version=2,
        )
        saved_query.set_projects([self.project.id])

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?id={saved_query.id}&statsPeriod=24h&project={self.project.id}"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1

        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_DISCOVER_TOTAL_PERIOD
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "p50(transaction.duration)"
        assert len(chart_data["stats"]["data"]) == INTERVALS_PER_DAY

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
        return_value={
            "default,first": {
                "data": [(i * INTERVAL_COUNT, [{"count": 0}]) for i in range(INTERVALS_PER_DAY)],
                "end": 1652903400,
                "isMetricsData": False,
                "order": 1,
                "start": 1652817000,
            },
            "default,second": {
                "data": [(i * INTERVAL_COUNT, [{"count": 0}]) for i in range(INTERVALS_PER_DAY)],
                "end": 1652903400,
                "isMetricsData": False,
                "order": 1,
                "start": 1652817000,
            },
        },
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_top_events_url_param(self, mock_generate_chart: MagicMock, _: MagicMock) -> None:
        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?field=message&field=event.type&field=count()&name=All+Events&query=message:[first,second]&sort=-count&statsPeriod=24h&display=top5&topEvents=2"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1

        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_DISCOVER_TOP5_PERIOD
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count()"
        assert len(chart_data["stats"].keys()) == 2
        first_key = list(chart_data["stats"].keys())[0]
        assert len(chart_data["stats"][first_key]["data"]) == INTERVALS_PER_DAY

    # patched return value determined by reading events stats output
    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
        return_value={
            "default,second": {
                "data": [(1212121, [{"count": 15}]), (1652659200, [{"count": 12}])],
                "order": 0,
                "isMetricsData": False,
                "start": 1652572800,
                "end": 1652659201,
            },
            "default,first": {
                "data": [(1652572800, [{"count": 15}]), (1652659200, [{"count": 11}])],
                "order": 1,
                "isMetricsData": False,
                "start": 1652572800,
                "end": 1652659201,
            },
        },
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_top_daily_events_renders_bar_chart(
        self, mock_generate_chart: MagicMock, _: MagicMock
    ) -> None:
        url = (
            f"https://sentry.io/organizations/{self.organization.slug}/discover/results/"
            "?field=message"
            "&field=event.type"
            "&field=count()"
            "&name=All+Events"
            "&query=message:[first,second]"
            "&sort=-count"
            "&statsPeriod=24h"
            "&display=dailytop5"
            "&topEvents=2"
        )
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1

        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_DISCOVER_TOP5_DAILY
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count()"
        assert len(chart_data["stats"].keys()) == 2
        first_key = list(chart_data["stats"].keys())[0]
        # Two buckets
        assert len(chart_data["stats"][first_key]["data"]) == 2

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
        return_value={
            "data": [(i * INTERVAL_COUNT, [{"count": 0}]) for i in range(INTERVALS_PER_DAY)],
            "end": 1652903400,
            "isMetricsData": False,
            "start": 1652817000,
        },
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_discover_short_url_without_project_ids(
        self, mock_generate_chart: MagicMock, _: MagicMock
    ) -> None:
        query = {
            "fields": ["title", "event.type", "project", "user.display", "timestamp"],
            "query": "",
            "yAxis": "count_unique(users)",
        }
        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.organization,
            created_by_id=self.user.id,
            name="Test query",
            query=query,
            version=2,
        )
        saved_query.set_projects([self.project.id])

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?id={saved_query.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1

        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_DISCOVER_TOTAL_PERIOD
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count_unique(users)"
        assert len(chart_data["stats"]["data"]) == INTERVALS_PER_DAY

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
        return_value={
            "data": [(i * INTERVAL_COUNT, [{"count": 0}]) for i in range(INTERVALS_PER_DAY)],
            "end": 1652903400,
            "isMetricsData": False,
            "start": 1652817000,
        },
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_discover_without_project_ids(
        self, mock_generate_chart, mock_get_event_stats_data
    ):
        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?dataset=errors&field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&query=&sort=-timestamp&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count()"
        assert len(chart_data["stats"]["data"]) == INTERVALS_PER_DAY

        assert len(mock_get_event_stats_data.mock_calls) == 1
        dataset = mock_get_event_stats_data.mock_calls[0][2]["dataset"]
        assert dataset == errors

    # patched return value determined by reading events stats output
    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
        return_value={
            "default,second": {
                "data": [(1212121, [{"count": 15}]), (1652659200, [{"count": 12}])],
                "order": 0,
                "isMetricsData": False,
                "start": 1652572800,
                "end": 1652659201,
            },
            "default,first": {
                "data": [(1652572800, [{"count": 15}]), (1652659200, [{"count": 11}])],
                "order": 1,
                "isMetricsData": False,
                "start": 1652572800,
                "end": 1652659201,
            },
        },
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_bar_chart_display_renders_bar_chart(
        self, mock_generate_chart: MagicMock, _: MagicMock
    ) -> None:
        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?display=bar&field=title&event.type%3Aerror&sort=-count&statsPeriod=24h&yAxis=count%28%29"

        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1

        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_DISCOVER_TOTAL_DAILY

    @patch("sentry.integrations.slack.unfurl.discover.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_bar_chart_interval_with_absolute_date(
        self, mock_generate_chart: MagicMock, api_mock: MagicMock
    ) -> None:
        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?display=bar&end=2022-09-16T23%3A59%3A59&field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&query=&sort=-timestamp&start=2022-09-09T00%3A00%3A00&utc=true&yAxis=count%28%29"

        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )

        assert len(mock_generate_chart.mock_calls) == 1
        assert len(api_mock.mock_calls) == 1

        assert "interval" in api_mock.call_args[1]["params"]
        assert api_mock.call_args[1]["params"]["interval"] == "1h"

    @patch("sentry.integrations.slack.unfurl.discover.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_bar_chart_interval_with_periodic_date(
        self, mock_generate_chart: MagicMock, api_mock: MagicMock
    ) -> None:
        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?display=bar&field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&query=&sort=-timestamp&statsPeriod=90d&utc=true&yAxis=count%28%29"

        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )

        assert len(mock_generate_chart.mock_calls) == 1
        assert len(api_mock.mock_calls) == 1

        assert "interval" in api_mock.call_args[1]["params"]
        assert api_mock.call_args[1]["params"]["interval"] == "1d"

    @patch("sentry.integrations.slack.unfurl.discover.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_saved_query_with_interval(
        self, mock_generate_chart: MagicMock, api_mock: MagicMock
    ) -> None:
        query = {
            "fields": ["title", "event.type", "project", "user.display", "timestamp"],
            "query": "",
            "yAxis": "count()",
            "interval": "10m",
            "statsPeriod": "24h",
        }
        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.organization,
            created_by_id=self.user.id,
            name="Test query",
            query=query,
            version=2,
        )
        saved_query.set_projects([self.project.id])
        api_mock.return_value.data = query

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?id={saved_query.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )

        assert len(mock_generate_chart.mock_calls) == 1
        assert len(api_mock.mock_calls) == 2

        assert "interval" in api_mock.call_args[1]["params"]
        assert api_mock.call_args[1]["params"]["interval"] == "10m"

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_saved_query_with_dataset(
        self, mock_generate_chart: MagicMock, mock_get_event_stats_data: MagicMock
    ) -> None:
        query = {
            "fields": ["title", "event.type", "project", "user.display", "timestamp"],
            "query": "",
            "yAxis": "count()",
            "interval": "10m",
            "statsPeriod": "24h",
        }
        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.organization,
            created_by_id=self.user.id,
            name="Test query",
            query=query,
            version=2,
            dataset=DiscoverSavedQueryTypes.TRANSACTION_LIKE,
        )
        saved_query.set_projects([self.project.id])

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?id={saved_query.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )

        assert len(mock_generate_chart.mock_calls) == 1

        assert len(mock_get_event_stats_data.mock_calls) == 1
        dataset = mock_get_event_stats_data.mock_calls[0][2]["dataset"]
        assert dataset == transactions

    @patch(
        "sentry.api.bases.organization_events.OrganizationEventsEndpointBase.get_event_stats_data",
        return_value={
            "data": [(i * INTERVAL_COUNT, [{"count": 0}]) for i in range(INTERVALS_PER_DAY)],
            "end": 1652903400,
            "isMetricsData": False,
            "start": 1652817000,
        },
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_discover_homepage(
        self, mock_generate_chart: MagicMock, mock_get_event_stats_data: MagicMock
    ) -> None:
        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/homepage/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&project={self.project.id}&query=&sort=-timestamp&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:discover-basic"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count()"
        assert len(chart_data["stats"]["data"]) == INTERVALS_PER_DAY

        assert len(mock_get_event_stats_data.mock_calls) == 1
        dataset = mock_get_event_stats_data.mock_calls[0][2]["dataset"]
        assert dataset == discover

    def _build_mock_timeseries_response(self, y_axis="avg(span.duration)"):
        return {
            "timeSeries": [
                {
                    "yAxis": y_axis,
                    "meta": {
                        "valueType": "duration",
                        "valueUnit": "millisecond",
                        "interval": INTERVAL_COUNT * 1000,
                    },
                    "values": [
                        {"timestamp": i * INTERVAL_COUNT * 1000, "value": 0, "incomplete": False}
                        for i in range(INTERVALS_PER_DAY)
                    ],
                }
            ],
        }

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D&project={self.project.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        assert link_type == LinkType.EXPLORE

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title="Explore Traces - avg(span.duration)", chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_EXPLORE_LINE
        chart_data = mock_generate_chart.call_args[0][1]
        assert "timeSeries" in chart_data

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_no_feature_flag(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D&project={self.project.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        unfurls = link_handlers[link_type].fn(self.integration, links, self.user)
        assert len(unfurls) == 0
        assert len(mock_generate_chart.mock_calls) == 0

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_with_groupby(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?aggregateField=%7B%22groupBy%22%3A%22span.op%22%7D&aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D&project={self.project.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 1
        assert len(mock_generate_chart.mock_calls) == 1
        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_EXPLORE_LINE

        # Verify sort is passed to the timeseries API for correct top events
        api_params = mock_client_get.call_args[1]["params"]
        assert api_params.getlist("sort") == ["-avg(span.duration)"]

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_with_groupby_explicit_sort(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?aggregateField=%7B%22groupBy%22%3A%22span.op%22%7D&aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D&aggregateSort=span.op&project={self.project.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 1

        # Verify explicit aggregateSort from the URL is used instead of the default
        api_params = mock_client_get.call_args[1]["params"]
        assert api_params.getlist("sort") == ["span.op"]

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_default_yaxis(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(
            data=self._build_mock_timeseries_response(y_axis="count(span.duration)")
        )
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?project={self.project.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 1
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert "timeSeries" in chart_data

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_malformed_aggregate_field(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(
            data=self._build_mock_timeseries_response(y_axis="count(span.duration)")
        )
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?aggregateField=not-valid-json&project={self.project.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        # Should still unfurl with default yAxis
        assert len(unfurls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert "timeSeries" in chart_data

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_end_to_end(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        """
        End-to-end test: URL → match → handler → verify API call args → verify chartcuterie input
        """
        mock_client_get.return_value = MagicMock(
            data=self._build_mock_timeseries_response(y_axis="avg(span.duration)")
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D&project={self.project.id}&statsPeriod=24h&query=span.op%3Ahttp"

        # Step 1: URL matching
        link_type, args = match_link(url)
        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["org_slug"] == self.organization.slug
        assert args["query"]["yAxis"] == "avg(span.duration)"
        assert args["query"]["project"] == str(self.project.id)
        assert args["query"]["statsPeriod"] == "24h"
        assert args["query"]["query"] == "span.op:http"

        # Step 2: Run handler
        links = [UnfurlableUrl(url=url, args=args)]
        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        # Step 3: Verify events-timeseries was called with correct args
        assert mock_client_get.call_count == 1
        call_kwargs = mock_client_get.call_args[1]
        assert "/events-timeseries/" in call_kwargs["path"]
        api_params = call_kwargs["params"]
        assert api_params["yAxis"] == "avg(span.duration)"
        assert api_params["dataset"] == "spans"
        assert api_params["referrer"] == "explore.slack.unfurl"
        assert api_params.get("query") == "span.op:http"

        # Step 4: Verify chartcuterie received correct data
        assert mock_generate_chart.call_count == 1
        chart_type = mock_generate_chart.call_args[0][0]
        chart_data = mock_generate_chart.call_args[0][1]

        assert chart_type == ChartType.SLACK_EXPLORE_LINE
        # timeSeries should be passed through directly from the API response
        time_series = chart_data["timeSeries"]
        assert isinstance(time_series, list)
        assert len(time_series) > 0
        first_series = time_series[0]
        assert first_series["yAxis"] == "avg(span.duration)"
        assert len(first_series["values"]) == INTERVALS_PER_DAY
        # Each data point has timestamp (ms) and value directly
        first_point = first_series["values"][0]
        assert "timestamp" in first_point
        assert "value" in first_point

        # Step 5: Verify the unfurl result
        assert len(unfurls) == 1
        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title="Explore Traces - avg(span.duration)", chart_url="chart-url"
            ).build()
        )

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_with_visualize_chart_type(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        # visualize param with chartType=0 (bar)
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?visualize=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%2C%22chartType%22%3A0%7D&project={self.project.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        assert link_type == LinkType.EXPLORE

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 1
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["type"] == "bar"

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_without_chart_type_defaults_to_line(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        # avg() is not a bar aggregate, so should default to line
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D&project={self.project.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["type"] == "line"

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_without_chart_type_count_defaults_to_bar(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(
            data=self._build_mock_timeseries_response(y_axis="count(span.duration)")
        )
        # count() should default to bar
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?aggregateField=%7B%22yAxes%22%3A%5B%22count(span.duration)%22%5D%7D&project={self.project.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["type"] == "bar"

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_with_interval(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D&project={self.project.id}&statsPeriod=24h&interval=1h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 1
        call_kwargs = mock_client_get.call_args[1]
        api_params = call_kwargs["params"]
        assert api_params["interval"] == "1h"

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_logs(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        # aggregateField includes chartType:0 (bar) to verify chart_type is passed through
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/logs/?aggregateField=%7B%22yAxes%22%3A%5B%22sum(payload_size)%22%5D%2C%22chartType%22%3A0%7D&project={self.project.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        assert link_type == LinkType.EXPLORE
        assert args["dataset"] == "logs"
        assert args["chart_type"] == 0

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title="Explore Logs - sum(payload_size)", chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["type"] == "bar"
        call_kwargs = mock_client_get.call_args[1]
        api_params = call_kwargs["params"]
        assert api_params["dataset"] == "logs"
        assert api_params["yAxis"] == "sum(payload_size)"

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_logs_customer_domain(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        url = f"https://{self.organization.slug}.sentry.io/explore/logs/?aggregateField=%7B%22yAxes%22%3A%5B%22count(payload_size)%22%5D%7D&project={self.project.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        assert link_type == LinkType.EXPLORE
        assert args["dataset"] == "logs"

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 1
        call_kwargs = mock_client_get.call_args[1]
        assert call_kwargs["params"]["dataset"] == "logs"
