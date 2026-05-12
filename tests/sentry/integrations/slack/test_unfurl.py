from datetime import datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.http.request import QueryDict
from django.test import RequestFactory
from django.utils import timezone

from sentry.charts.types import ChartType
from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models.incident import Incident
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.integrations.slack.message_builder.discover import SlackDiscoverMessageBuilder
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.integrations.slack.message_builder.metric_alerts import SlackMetricAlertMessageBuilder
from sentry.integrations.slack.unfurl.dashboards import build_widget_timeseries_params
from sentry.integrations.slack.unfurl.handlers import link_handlers, match_link
from sentry.integrations.slack.unfurl.types import LinkType, UnfurlableUrl
from sentry.models.dashboard_widget import DashboardWidgetDisplayTypes, DashboardWidgetTypes
from sentry.models.groupopenperiod import GroupOpenPeriod
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
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.migration_helpers.alert_rule import migrate_alert_rule
from sentry.workflow_engine.models import IncidentGroupOpenPeriod

pytestmark = [requires_snuba, pytest.mark.sentry_metrics]

INTERVAL_COUNT = 300
INTERVALS_PER_DAY = int(60 * 60 * 24 / INTERVAL_COUNT)


@pytest.mark.parametrize(
    "url,expected",
    [
        ("http://invalid_link", (None, None)),
        (
            "https://sentry.io/organizations/org1/issues/12345/",
            (LinkType.ISSUES, {"org_slug": "org1", "issue_id": 12345, "event_id": None}),
        ),
        (
            "https://org1.sentry.io/issues/12345/",
            (LinkType.ISSUES, {"org_slug": "org1", "issue_id": 12345, "event_id": None}),
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
                    "query": QueryDict(
                        "yAxis=avg(span.duration)&project=1&statsPeriod=24h&interval=5m"
                    ),
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
                    "query": QueryDict("yAxis=count(span.duration)&statsPeriod=24h&interval=5m"),
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
                    "query": QueryDict(
                        "yAxis=sum(payload_size)&project=1&statsPeriod=24h&interval=5m"
                    ),
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
                    "query": QueryDict("yAxis=count(payload_size)&statsPeriod=24h&interval=5m"),
                    "chart_type": None,
                    "dataset": SupportedTraceItemType.LOGS,
                },
            ),
        ),
        (
            "https://sentry.io/organizations/org1/explore/metrics/?metric=%7B%22aggregateFields%22%3A%5B%7B%22yAxes%22%3A%5B%22sum(value)%22%5D%7D%5D%7D&project=1&statsPeriod=7d",
            (
                LinkType.EXPLORE,
                {
                    "org_slug": "org1",
                    "query": QueryDict("yAxis=sum(value)&project=1&statsPeriod=7d&interval=30m"),
                    "chart_type": None,
                    "dataset": SupportedTraceItemType.TRACEMETRICS,
                },
            ),
        ),
        (
            "https://org1.sentry.io/explore/metrics/?metric=%7B%22aggregateFields%22%3A%5B%7B%22yAxes%22%3A%5B%22avg(value)%22%5D%7D%5D%7D&statsPeriod=24h",
            (
                LinkType.EXPLORE,
                {
                    "org_slug": "org1",
                    "query": QueryDict("yAxis=avg(value)&statsPeriod=24h&interval=5m"),
                    "chart_type": None,
                    "dataset": SupportedTraceItemType.TRACEMETRICS,
                },
            ),
        ),
        (
            "https://sentry.io/organizations/org1/explore/traces/trace/trace_id_123/?project=1&statsPeriod=24h",
            (None, None),
        ),
        (
            "https://org1.sentry.io/explore/traces/trace/trace_id_123/?project=1&statsPeriod=24h",
            (None, None),
        ),
        (
            "https://sentry.io/organizations/org1/explore/traces/other/?project=1",
            (None, None),
        ),
        (
            "https://org1.sentry.io/explore/traces/other/?project=1",
            (None, None),
        ),
        (
            "https://sentry.io/organizations/org1/explore/logs/trace/trace_id_123/?project=1",
            (None, None),
        ),
        (
            "https://org1.sentry.io/explore/logs/trace/trace_id_123/?project=1",
            (None, None),
        ),
        (
            "https://sentry.io/organizations/org1/explore/metrics/trace/trace_id_123/?project=1",
            (None, None),
        ),
        (
            "https://org1.sentry.io/explore/metrics/trace/trace_id_123/?project=1",
            (None, None),
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

    def _wire_workflow_engine_for_incident(self, alert_rule, incident: Incident) -> None:
        """
        Wire up the workflow engine fixtures so that the /incidents/ endpoint
        (which always routes through _get_workflow_engine) returns this incident.
        """
        _, _, _, detector, _, _, _, _ = migrate_alert_rule(alert_rule)
        group = self.create_group(
            project=self.project,
            type=MetricIssue.type_id,
            priority=PriorityLevel.HIGH,
            first_seen=incident.date_started,
        )
        self.create_detector_group(detector=detector, group=group)
        gop = GroupOpenPeriod.objects.get(group=group)
        # Align the open period's date_started with the incident's so the chart's
        # time-window query (which truncates to seconds via strftime) includes it.
        gop.update(date_started=incident.date_started)
        IncidentGroupOpenPeriod.objects.create(
            group_open_period=gop,
            incident_id=incident.id,
            incident_identifier=incident.identifier,
        )

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
        self._wire_workflow_engine_for_incident(alert_rule, incident)

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
        self._wire_workflow_engine_for_incident(alert_rule, incident)

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
        self._wire_workflow_engine_for_incident(alert_rule, incident)

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
        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_TIMESERIES
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
        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_TIMESERIES

        # Verify sort is passed to the timeseries API for correct top events
        api_params = mock_client_get.call_args[1]["params"]
        assert api_params["sort"] == "-avg(span.duration)"

    @patch("sentry.api.client.resolve")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_forwards_multiple_groupbys_to_api(
        self, mock_generate_chart: MagicMock, mock_resolve: MagicMock
    ) -> None:
        # Don't mock client.get — exercise the real API client so we catch
        # multi-value param collapse on the way to events-timeseries.
        mock_response = MagicMock(
            status_code=200,
            data=self._build_mock_timeseries_response(y_axis="count(span.duration)"),
        )
        mock_view = MagicMock(return_value=mock_response)
        mock_resolve.return_value = (mock_view, (), {})

        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?aggregateField=%7B%22groupBy%22%3A%22transaction%22%7D&aggregateField=%7B%22groupBy%22%3A%22browser.name%22%7D&aggregateField=%7B%22yAxes%22%3A%5B%22count(span.duration)%22%5D%2C%22chartType%22%3A1%7D&project={self.project.id}&statsPeriod=14d"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [UnfurlableUrl(url=url, args=args)]
        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            link_handlers[link_type].fn(self.integration, links, self.user)

        mock_view.assert_called_once()
        request = mock_view.call_args[0][0]
        assert request.GET.getlist("groupBy") == ["transaction", "browser.name"]
        assert request.GET.getlist("yAxis") == ["count(span.duration)"]
        assert request.GET["dataset"] == "spans"

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
        assert api_params["sort"] == "span.op"

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

        assert chart_type == ChartType.SLACK_TIMESERIES
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

    def test_unfurl_explore_non_dict_aggregate_field(self) -> None:
        # aggregateField that parses to a non-dict (int, list, string, null)
        # must not crash the arg mapper; it should fall back to defaults.
        url = (
            "https://sentry.io/organizations/org1/explore/traces/"
            "?aggregateField=42&aggregateField=%5B%5D&aggregateField=null"
            "&project=1&statsPeriod=24h"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("yAxis") == ["count(span.duration)"]

    def test_unfurl_explore_metrics_collects_all_y_axes(self) -> None:
        # Metrics encodes multiple aggregates as multiple `aggregateFields` entries
        # but the FE renders them as multiple series on a single chart, so the
        # unfurl must forward every yAxes entry to events-timeseries.
        url = (
            "https://sentry.io/organizations/org1/explore/metrics/"
            "?metric=%7B%22aggregateFields%22%3A%5B"
            "%7B%22yAxes%22%3A%5B%22p50(value%2Cmy.metric%2Cdistribution%2Cmillisecond)%22%5D%7D%2C"
            "%7B%22yAxes%22%3A%5B%22p95(value%2Cmy.metric%2Cdistribution%2Cmillisecond)%22%5D%7D"
            "%5D%7D&project=1&statsPeriod=14d"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("yAxis") == [
            "p50(value,my.metric,distribution,millisecond)",
            "p95(value,my.metric,distribution,millisecond)",
        ]

    def test_unfurl_explore_metrics_multiple_metric_params_uses_first(self) -> None:
        # When the URL has multiple `metric` params the FE renders one chart per
        # metric. The unfurl is single-chart, so it sticks to the first metric
        # and drops the rest rather than mashing axes from different metrics.
        url = (
            "https://sentry.io/organizations/org1/explore/metrics/"
            "?metric=%7B%22aggregateFields%22%3A%5B%7B%22yAxes%22%3A%5B%22p50(value%2Cmy.metric%2Cdistribution%2Cmillisecond)%22%5D%7D%5D%7D"
            "&metric=%7B%22aggregateFields%22%3A%5B%7B%22yAxes%22%3A%5B%22p95(value%2Cmy.metric%2Cdistribution%2Cmillisecond)%22%5D%7D%5D%7D"
            "&project=1&statsPeriod=14d"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("yAxis") == [
            "p50(value,my.metric,distribution,millisecond)",
        ]

    def test_unfurl_explore_metrics_drops_aggregate_sort_referencing_unknown_field(
        self,
    ) -> None:
        # The metric JSON's `aggregateSortBys` can reference a metric/function that
        # isn't in the active `aggregateFields` yAxes (e.g. left over from a prior
        # visualization). Mirror the frontend's validateAggregateSort by dropping
        # the stale sort so events-timeseries falls back to `-yAxes[0]`.
        url = (
            "https://sentry.io/organizations/org1/explore/metrics/"
            "?metric=%7B%22aggregateFields%22%3A%5B"
            "%7B%22yAxes%22%3A%5B%22p95(value%2Cmy.metric%2Cdistribution%2Cmillisecond)%22%5D%7D"
            "%5D%2C%22aggregateSortBys%22%3A%5B%7B%22field%22%3A"
            "%22sum(value%2Cother.metric%2Cdistribution%2Cmillisecond)%22%2C%22kind%22%3A%22desc%22%7D%5D%7D"
            "&project=1&statsPeriod=24h"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("yAxis") == [
            "p95(value,my.metric,distribution,millisecond)",
        ]
        assert args["query"].getlist("sort") == []

    def test_unfurl_explore_metrics_drops_aggregate_sort_when_aggregate_function_differs(
        self,
    ) -> None:
        # Same metric expression but the sort uses a different aggregate function
        # than the visualized yAxis (sum vs p95). The frontend treats these as
        # different sort targets, so the unfurl must drop the stale sort too.
        url = (
            "https://sentry.io/organizations/org1/explore/metrics/"
            "?metric=%7B%22aggregateFields%22%3A%5B"
            "%7B%22yAxes%22%3A%5B%22p95(value%2Cmy.metric%2Cdistribution%2Cmillisecond)%22%5D%7D"
            "%5D%2C%22aggregateSortBys%22%3A%5B%7B%22field%22%3A"
            "%22sum(value%2Cmy.metric%2Cdistribution%2Cmillisecond)%22%2C%22kind%22%3A%22desc%22%7D%5D%7D"
            "&project=1&statsPeriod=24h"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("sort") == []

    def test_unfurl_explore_metrics_keeps_aggregate_sort_when_field_matches_yaxis(
        self,
    ) -> None:
        url = (
            "https://sentry.io/organizations/org1/explore/metrics/"
            "?metric=%7B%22aggregateFields%22%3A%5B"
            "%7B%22groupBy%22%3A%22browser.name%22%7D%2C"
            "%7B%22yAxes%22%3A%5B%22sum(value%2Cmy.metric%2Cdistribution%2Cmillisecond)%22%5D%7D"
            "%5D%2C%22aggregateSortBys%22%3A%5B%7B%22field%22%3A"
            "%22sum(value%2Cmy.metric%2Cdistribution%2Cmillisecond)%22%2C%22kind%22%3A%22desc%22%7D%5D%7D"
            "&project=1&statsPeriod=24h"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("sort") == [
            "-sum(value,my.metric,distribution,millisecond)",
        ]

    def test_unfurl_explore_metrics_keeps_aggregate_sort_when_field_matches_groupby(
        self,
    ) -> None:
        url = (
            "https://sentry.io/organizations/org1/explore/metrics/"
            "?metric=%7B%22aggregateFields%22%3A%5B"
            "%7B%22groupBy%22%3A%22browser.name%22%7D%2C"
            "%7B%22yAxes%22%3A%5B%22sum(value%2Cmy.metric%2Cdistribution%2Cmillisecond)%22%5D%7D"
            "%5D%2C%22aggregateSortBys%22%3A%5B%7B%22field%22%3A%22browser.name%22%2C%22kind%22%3A%22asc%22%7D%5D%7D"
            "&project=1&statsPeriod=24h"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("sort") == ["browser.name"]

    def test_unfurl_explore_aggregate_field_takes_precedence_over_visualize(self) -> None:
        url = (
            "https://sentry.io/organizations/org1/explore/traces/"
            "?aggregateField=%7B%22groupBy%22%3A%22gen_ai.tool.name%22%7D"
            "&aggregateField=%7B%22yAxes%22%3A%5B%22count(span.duration)%22%5D%2C%22chartType%22%3A0%7D"
            "&visualize=%7B%22chartType%22%3A0%2C%22yAxes%22%3A%5B%22count_unique(user.id)%22%5D%7D"
            "&project=1&query=user.id%1234&statsPeriod=30d"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("yAxis") == ["count(span.duration)"]
        assert args["query"].getlist("groupBy") == ["gen_ai.tool.name"]
        assert args["chart_type"] == 0

    def test_unfurl_explore_drops_aggregate_sort_referencing_unknown_field(self) -> None:
        # When aggregateSort references a function that isn't in the active
        # yAxes (e.g. a stale sort left over from a different visualize), the
        # frontend's validateAggregateSort discards it and falls back to
        # `-yAxes[0]`. The unfurl must mirror that, otherwise events-timeseries
        # gets sorted by an aggregate it never selected and returns no data.
        url = (
            "https://sentry.io/organizations/org1/explore/traces/"
            "?aggregateField=%7B%22groupBy%22%3A%22gen_ai.tool.name%22%7D"
            "&aggregateField=%7B%22yAxes%22%3A%5B%22count(span.duration)%22%5D%2C%22chartType%22%3A0%7D"
            "&aggregateSort=-count_unique(user.id)"
            "&project=1&query=user.id%3A12345&statsPeriod=30d"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("yAxis") == ["count(span.duration)"]
        assert args["query"].getlist("groupBy") == ["gen_ai.tool.name"]
        # The stale aggregateSort is dropped; unfurl_explore will then default
        # to `-count(span.duration)` for the topEvents sort.
        assert args["query"].getlist("sort") == []

    def test_unfurl_explore_keeps_aggregate_sort_when_field_matches_yaxis(self) -> None:
        url = (
            "https://sentry.io/organizations/org1/explore/traces/"
            "?aggregateField=%7B%22groupBy%22%3A%22gen_ai.tool.name%22%7D"
            "&aggregateField=%7B%22yAxes%22%3A%5B%22count(span.duration)%22%5D%7D"
            "&aggregateSort=-count(span.duration)"
            "&project=1&statsPeriod=30d"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("sort") == ["-count(span.duration)"]

    def test_unfurl_explore_keeps_aggregate_sort_when_field_matches_groupby(self) -> None:
        url = (
            "https://sentry.io/organizations/org1/explore/traces/"
            "?aggregateField=%7B%22groupBy%22%3A%22gen_ai.tool.name%22%7D"
            "&aggregateField=%7B%22yAxes%22%3A%5B%22count(span.duration)%22%5D%7D"
            "&aggregateSort=gen_ai.tool.name"
            "&project=1&statsPeriod=30d"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("sort") == ["gen_ai.tool.name"]

    def test_unfurl_explore_multi_aggregate_uses_first_chart(self) -> None:
        # Two charts: count with chartType=2 (area, first) and avg (second).
        # The unfurl must render only the first chart and not merge avg's
        # yAxis into the request.
        url = (
            "https://sentry.io/organizations/org1/explore/traces/"
            "?aggregateField=%7B%22groupBy%22%3A%22%22%7D"
            "&aggregateField=%7B%22yAxes%22%3A%5B%22count(span.duration)%22%5D%2C%22chartType%22%3A2%7D"
            "&aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D"
            "&aggregateSort=-http.status_code&project=1&query=span.category:http&statsPeriod=24h"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["chart_type"] == 2
        assert args["query"].getlist("yAxis") == ["count(span.duration)"]

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

    def test_match_link_explore_default_interval_ladder(self) -> None:
        # Mirrors MINIMUM_INTERVAL in static/app/utils/useChartInterval.tsx — if
        # this list changes, the ladder in explore.py must change with it.
        cases = [
            ("1h", "1m"),
            ("6h", "1m"),
            ("12h", "5m"),
            ("2d", "10m"),
            ("4d", "30m"),
            ("14d", "1h"),
            ("30d", "3h"),
        ]
        for stats_period, expected_interval in cases:
            url = (
                f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/"
                f"?aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D"
                f"&project={self.project.id}&statsPeriod={stats_period}"
            )
            _, args = match_link(url)
            assert args is not None
            assert args["query"]["interval"] == expected_interval, (
                f"statsPeriod={stats_period} expected {expected_interval}, "
                f"got {args['query']['interval']}"
            )

    def test_match_link_explore_clamps_too_fine_url_interval_to_ladder_minimum(
        self,
    ) -> None:
        # Mirrors the frontend's useChartIntervalImpl: if the URL's explicit
        # interval is finer than the ladder minimum for the time range it falls
        # back to the minimum. Without clamping, a stale `interval=1m` pasted
        # into a 7d view yields ~10k buckets that events-timeseries rejects.
        cases = [
            # 7d → ladder minimum is 30m; 1m must be clamped up.
            (
                f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/"
                f"?aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D"
                f"&interval=1m&project={self.project.id}&statsPeriod=7d",
                "30m",
            ),
            # 30d → ladder minimum is 3h; 5m must be clamped up.
            (
                f"https://sentry.io/organizations/{self.organization.slug}/explore/metrics/"
                f"?metric=%7B%22aggregateFields%22%3A%5B%7B%22yAxes%22%3A%5B%22sum(value)%22%5D%7D%5D%7D"
                f"&interval=5m&project={self.project.id}&statsPeriod=30d",
                "3h",
            ),
            # 14d → ladder minimum is 1h; 1m must be clamped up.
            (
                f"https://sentry.io/organizations/{self.organization.slug}/explore/logs/"
                f"?aggregateField=%7B%22yAxes%22%3A%5B%22count(message)%22%5D%7D"
                f"&interval=1m&project={self.project.id}&statsPeriod=14d",
                "1h",
            ),
        ]
        for url, expected_interval in cases:
            _, args = match_link(url)
            assert args is not None
            assert args["query"]["interval"] == expected_interval, (
                f"url={url}: expected {expected_interval}, got {args['query']['interval']}"
            )

    def test_match_link_explore_keeps_url_interval_when_coarser_than_minimum(
        self,
    ) -> None:
        # An explicit interval that is at or above the ladder minimum should be
        # forwarded as-is — only too-fine intervals are clamped.
        url = (
            f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/"
            f"?aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D"
            f"&interval=6h&project={self.project.id}&statsPeriod=7d"
        )
        _, args = match_link(url)
        assert args is not None
        assert args["query"]["interval"] == "6h"

    def test_match_link_explore_default_interval_for_logs_and_metrics(self) -> None:
        # Logs and metrics use the same useChartInterval default as traces, so
        # the URL → timeseries conversion should pick the same interval for the
        # same time range.
        urls = [
            (
                f"https://sentry.io/organizations/{self.organization.slug}/explore/logs/"
                f"?aggregateField=%7B%22yAxes%22%3A%5B%22count(message)%22%5D%7D"
                f"&project={self.project.id}&statsPeriod=14d"
            ),
            (
                f"https://sentry.io/organizations/{self.organization.slug}/explore/metrics/"
                f"?metric=%7B%22aggregateFields%22%3A%5B%7B%22yAxes%22%3A%5B%22sum(value)%22%5D%7D%5D%7D"
                f"&project={self.project.id}&statsPeriod=14d"
            ),
        ]
        for url in urls:
            _, args = match_link(url)
            assert args is not None
            assert args["query"]["interval"] == "1h"

    def test_match_link_explore_default_interval_when_no_stats_period(self) -> None:
        # When neither statsPeriod nor start/end is supplied, the unfurl falls
        # back to DEFAULT_PERIOD (14d), so the default interval should be 1h.
        url = (
            f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/"
            f"?aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D"
            f"&project={self.project.id}"
        )
        _, args = match_link(url)
        assert args is not None
        assert args["query"]["statsPeriod"] == "14d"
        assert args["query"]["interval"] == "1h"

    def test_match_link_explore_preserves_explicit_interval(self) -> None:
        url = (
            f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/"
            f"?aggregateField=%7B%22yAxes%22%3A%5B%22avg(span.duration)%22%5D%7D"
            f"&project={self.project.id}&statsPeriod=24h&interval=1h"
        )
        _, args = match_link(url)
        assert args is not None
        assert args["query"]["interval"] == "1h"

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

    def test_map_explore_query_args_logs_ignores_table_sort_for_chart(self) -> None:
        # `logsSortBys` is the samples-mode logs table sort (typically
        # `-timestamp`). The unfurl is rendering the chart, not the table, so
        # the table sort must not leak into the events-timeseries `sort` param —
        # it would feed topEvents a non-aggregate field and return no data.
        url = (
            f"https://sentry.io/organizations/{self.organization.slug}/explore/logs/"
            "?aggregateField=%7B%22groupBy%22%3A%22browser.name%22%7D"
            "&aggregateField=%7B%22yAxes%22%3A%5B%22count(message)%22%5D%7D"
            "&logsSortBys=-timestamp&mode=aggregate"
            f"&project={self.project.id}&statsPeriod=7d"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("groupBy") == ["browser.name"]
        # logsSortBys is ignored — `unfurl_explore` will default to
        # `-count(message)` for the topEvents sort.
        assert args["query"].getlist("sort") == []

    def test_map_explore_query_args_logs_uses_aggregate_sort(self) -> None:
        # `logsAggregateSortBys` is the aggregate-mode chart sort. When it
        # references the active yAxis it should be forwarded to
        # events-timeseries as the topEvents sort.
        url = (
            f"https://sentry.io/organizations/{self.organization.slug}/explore/logs/"
            "?aggregateField=%7B%22groupBy%22%3A%22severity%22%7D"
            "&aggregateField=%7B%22yAxes%22%3A%5B%22count(message)%22%5D%7D"
            "&logsAggregateSortBys=-count(message)&mode=aggregate"
            f"&project={self.project.id}&statsPeriod=7d"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("sort") == ["-count(message)"]

    def test_map_explore_query_args_logs_drops_stale_aggregate_sort(self) -> None:
        # If `logsAggregateSortBys` references a function that isn't in the
        # active yAxes/groupBys, drop it so the unfurl falls back to
        # `-yAxes[0]`, mirroring the frontend's validateAggregateSort.
        url = (
            f"https://sentry.io/organizations/{self.organization.slug}/explore/logs/"
            "?aggregateField=%7B%22groupBy%22%3A%22severity%22%7D"
            "&aggregateField=%7B%22yAxes%22%3A%5B%22count(message)%22%5D%7D"
            "&logsAggregateSortBys=-p95(message.length)&mode=aggregate"
            f"&project={self.project.id}&statsPeriod=7d"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.EXPLORE
        assert args is not None
        assert args["query"].getlist("sort") == []

    def test_map_explore_query_args_logs_query(self) -> None:
        url = (
            f"https://sentry.io/organizations/{self.organization.slug}/explore/logs/"
            "?aggregateField=%7B%22yAxes%22%3A%5B%22count(message)%22%5D%7D"
            "&logsQuery=severity%3Aerror"
            f"&project={self.project.id}&statsPeriod=24h"
        )
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        assert link_type == LinkType.EXPLORE
        assert args["dataset"] == SupportedTraceItemType.LOGS
        assert args["query"]["query"] == "severity:error"
        assert args["query"]["yAxis"] == "count(message)"

    def test_map_explore_query_args_spans_query_and_sort(self) -> None:
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/traces/?visualize=%7B%22yAxes%22%3A%5B%22count(span.duration)%22%5D%7D&query=span.op%3Ahttp&aggregateSort=-count(span.duration)&project={self.project.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        assert link_type == LinkType.EXPLORE
        assert args["dataset"] == SupportedTraceItemType.SPANS
        assert args["query"]["query"] == "span.op:http"
        assert args["query"]["sort"] == "-count(span.duration)"

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

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_metrics(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        url = f"https://sentry.io/organizations/{self.organization.slug}/explore/metrics/?metric=%7B%22aggregateFields%22%3A%5B%7B%22yAxes%22%3A%5B%22sum(value%2Cmy.metric%2Cdistribution%2Cmillisecond)%22%5D%7D%5D%7D&project={self.project.id}&statsPeriod=7d"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        assert link_type == LinkType.EXPLORE
        assert args["dataset"] == SupportedTraceItemType.TRACEMETRICS

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title="Explore Metrics - sum(value,my.metric,distribution,millisecond)",
                chart_url="chart-url",
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        call_kwargs = mock_client_get.call_args[1]
        api_params = call_kwargs["params"]
        assert api_params["dataset"] == "tracemetrics"
        assert api_params["yAxis"] == "sum(value,my.metric,distribution,millisecond)"

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_metrics_skips_hidden_charts(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        # First metric param is hidden (visible=false); second has no `visible`
        # field so it defaults to true. Unfurl should render the second chart.
        hidden_metric = (
            "%7B%22aggregateFields%22%3A%5B%7B%22yAxes%22%3A%5B%22p50(value)%22%5D%2C"
            "%22visible%22%3Afalse%7D%5D%7D"
        )
        visible_metric = (
            "%7B%22aggregateFields%22%3A%5B%7B%22yAxes%22%3A%5B%22p95(value)%22%5D%7D%5D%7D"
        )
        url = (
            f"https://sentry.io/organizations/{self.organization.slug}/explore/metrics/"
            f"?metric={hidden_metric}&metric={visible_metric}"
            f"&project={self.project.id}&statsPeriod=7d"
        )
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [UnfurlableUrl(url=url, args=args)]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title="Explore Metrics - p95(value)",
                chart_url="chart-url",
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        api_params = mock_client_get.call_args[1]["params"]
        assert api_params["yAxis"] == "p95(value)"

    @patch(
        "sentry.integrations.slack.unfurl.explore.client.get",
    )
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_explore_metrics_all_hidden_returns_no_unfurl(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        hidden_metric = (
            "%7B%22aggregateFields%22%3A%5B%7B%22yAxes%22%3A%5B%22p50(value)%22%5D%2C"
            "%22visible%22%3Afalse%7D%5D%7D"
        )
        url = (
            f"https://sentry.io/organizations/{self.organization.slug}/explore/metrics/"
            f"?metric={hidden_metric}&project={self.project.id}&statsPeriod=7d"
        )
        link_type, args = match_link(url)

        if not args or not link_type:
            raise AssertionError("Missing link_type/args")

        links = [UnfurlableUrl(url=url, args=args)]

        with self.feature(["organizations:data-browsing-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert unfurls == {}
        assert mock_generate_chart.call_count == 0
        assert mock_client_get.call_count == 0

    def _create_spans_widget(
        self,
        display_type: int = DashboardWidgetDisplayTypes.LINE_CHART,
        aggregates: list[str] | None = None,
        columns: list[str] | None = None,
        conditions: str = "",
        orderby: str = "",
        title: str = "My Spans Widget",
    ):
        dashboard = self.create_dashboard(organization=self.organization)
        widget = self.create_dashboard_widget(
            dashboard=dashboard,
            title=title,
            display_type=display_type,
            widget_type=DashboardWidgetTypes.SPANS,
            order=0,
        )
        self.create_dashboard_widget_query(
            widget=widget,
            order=0,
            fields=aggregates or ["count(span.duration)"],
            aggregates=aggregates or ["count(span.duration)"],
            columns=columns or [],
            conditions=conditions,
            orderby=orderby,
        )
        return dashboard, widget

    @patch("sentry.integrations.slack.unfurl.dashboards.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_dashboards_spans_widget(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        dashboard, widget = self._create_spans_widget(
            aggregates=["avg(span.duration)"],
        )

        url = (
            f"https://sentry.io/organizations/{self.organization.slug}"
            f"/dashboard/{dashboard.id}/widget/0/?statsPeriod=7d"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.DASHBOARDS
        assert args is not None
        assert args["org_slug"] == self.organization.slug
        assert args["dashboard_id"] == dashboard.id
        assert args["widget_index"] == 0

        links = [UnfurlableUrl(url=url, args=args)]

        with self.feature(["organizations:dashboards-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(title=widget.title, chart_url="chart-url").build()
        )
        assert mock_generate_chart.call_count == 1
        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_DASHBOARDS_WIDGET
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["widget"]["title"] == "My Spans Widget"
        assert chart_data["widget"]["widgetType"] == "spans"
        assert chart_data["widget"]["displayType"] == "line"
        assert chart_data["widget"]["queries"][0]["aggregates"] == ["avg(span.duration)"]
        assert all(pair[1] == 0 for pair in chart_data["timeSeries"])
        assert chart_data["timeSeries"][0][0]["yAxis"] == "avg(span.duration)"

        api_params = mock_client_get.call_args[1]["params"]
        assert "/events-timeseries/" in mock_client_get.call_args[1]["path"]
        assert api_params["yAxis"] == ["avg(span.duration)"]
        assert api_params["dataset"] == "spans"
        assert api_params["referrer"] == "dashboards.slack.unfurl"
        assert api_params["statsPeriod"] == "7d"

    @patch("sentry.integrations.slack.unfurl.dashboards.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_dashboards_customer_domain(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        dashboard, _ = self._create_spans_widget()

        url = (
            f"https://{self.organization.slug}.sentry.io"
            f"/dashboard/{dashboard.id}/widget/0/?statsPeriod=7d"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.DASHBOARDS
        assert args is not None

        links = [UnfurlableUrl(url=url, args=args)]
        with self.feature(["organizations:dashboards-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 1
        assert mock_generate_chart.call_count == 1

    @patch("sentry.integrations.slack.unfurl.dashboards.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_dashboards_no_feature_flag(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        dashboard, _ = self._create_spans_widget()

        url = (
            f"https://sentry.io/organizations/{self.organization.slug}"
            f"/dashboard/{dashboard.id}/widget/0/?statsPeriod=7d"
        )
        link_type, args = match_link(url)

        assert link_type == LinkType.DASHBOARDS
        assert args is not None

        links = [UnfurlableUrl(url=url, args=args)]
        unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 0
        assert mock_generate_chart.call_count == 0
        assert mock_client_get.call_count == 0

    @patch("sentry.integrations.slack.unfurl.dashboards.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_dashboards_unsupported_widget_type_is_skipped(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        dashboard = self.create_dashboard(organization=self.organization)
        widget = self.create_dashboard_widget(
            dashboard=dashboard,
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.RELEASE_HEALTH,
            order=0,
        )
        self.create_dashboard_widget_query(
            widget=widget,
            order=0,
            fields=["count()"],
            aggregates=["count()"],
            columns=[],
            conditions="",
        )

        url = (
            f"https://sentry.io/organizations/{self.organization.slug}"
            f"/dashboard/{dashboard.id}/widget/0/?statsPeriod=7d"
        )
        link_type, args = match_link(url)
        assert link_type is not None and args is not None
        links = [UnfurlableUrl(url=url, args=args)]

        with self.feature(["organizations:dashboards-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 0
        assert mock_client_get.call_count == 0
        assert mock_generate_chart.call_count == 0

    @patch("sentry.integrations.slack.unfurl.dashboards.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_dashboards_unsupported_display_type(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        dashboard, _ = self._create_spans_widget(
            display_type=DashboardWidgetDisplayTypes.TABLE,
        )

        url = (
            f"https://sentry.io/organizations/{self.organization.slug}"
            f"/dashboard/{dashboard.id}/widget/0/?statsPeriod=7d"
        )
        link_type, args = match_link(url)
        assert link_type is not None and args is not None
        links = [UnfurlableUrl(url=url, args=args)]

        with self.feature(["organizations:dashboards-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 0
        assert mock_client_get.call_count == 0

    @patch("sentry.integrations.slack.unfurl.dashboards.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_dashboards_widget_not_found(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        dashboard = self.create_dashboard(organization=self.organization)

        # widget index 0 does not exist — dashboard has no widgets
        url = (
            f"https://sentry.io/organizations/{self.organization.slug}"
            f"/dashboard/{dashboard.id}/widget/0/?statsPeriod=7d"
        )
        link_type, args = match_link(url)
        assert link_type is not None and args is not None
        links = [UnfurlableUrl(url=url, args=args)]

        with self.feature(["organizations:dashboards-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 0
        assert mock_client_get.call_count == 0

    @patch("sentry.integrations.slack.unfurl.dashboards.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_dashboards_multiple_queries_are_joined(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        # Each call to the timeseries endpoint returns a single series.
        # With two widget queries, we expect two calls and the unfurl
        # should combine both timeSeries into a single chart.
        mock_client_get.side_effect = [
            MagicMock(data=self._build_mock_timeseries_response(y_axis="avg(span.duration)")),
            MagicMock(data=self._build_mock_timeseries_response(y_axis="p75(span.duration)")),
        ]

        dashboard = self.create_dashboard(organization=self.organization)
        widget = self.create_dashboard_widget(
            dashboard=dashboard,
            title="Spans Widget",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.SPANS,
            order=0,
        )
        self.create_dashboard_widget_query(
            widget=widget,
            order=0,
            fields=["avg(span.duration)"],
            aggregates=["avg(span.duration)"],
            columns=[],
            conditions="",
        )
        self.create_dashboard_widget_query(
            widget=widget,
            order=1,
            fields=["p75(span.duration)"],
            aggregates=["p75(span.duration)"],
            columns=[],
            conditions="",
        )

        url = (
            f"https://sentry.io/organizations/{self.organization.slug}"
            f"/dashboard/{dashboard.id}/widget/0/?statsPeriod=7d"
        )
        link_type, args = match_link(url)
        assert link_type is not None and args is not None
        links = [UnfurlableUrl(url=url, args=args)]

        with self.feature(["organizations:dashboards-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 1
        assert mock_client_get.call_count == 2
        chart_data = mock_generate_chart.call_args[0][1]
        pairs = chart_data["timeSeries"]
        assert [pair[0]["yAxis"] for pair in pairs] == [
            "avg(span.duration)",
            "p75(span.duration)",
        ]
        assert [pair[1] for pair in pairs] == [0, 1]

    @patch("sentry.integrations.slack.unfurl.dashboards.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_dashboards_multi_query_same_aggregate(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.side_effect = [
            MagicMock(data=self._build_mock_timeseries_response(y_axis="count(span.duration)")),
            MagicMock(data=self._build_mock_timeseries_response(y_axis="count(span.duration)")),
        ]

        dashboard = self.create_dashboard(organization=self.organization)
        widget = self.create_dashboard_widget(
            dashboard=dashboard,
            title="Multi query",
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            widget_type=DashboardWidgetTypes.SPANS,
            order=0,
        )
        self.create_dashboard_widget_query(
            widget=widget,
            order=0,
            name="",
            fields=["count(span.duration)"],
            aggregates=["count(span.duration)"],
            columns=[],
            conditions="span.op:db",
        )
        self.create_dashboard_widget_query(
            widget=widget,
            order=1,
            name="",
            fields=["count(span.duration)"],
            aggregates=["count(span.duration)"],
            columns=[],
            conditions="span.op:http.client",
        )

        url = (
            f"https://sentry.io/organizations/{self.organization.slug}"
            f"/dashboard/{dashboard.id}/widget/0/?statsPeriod=7d"
        )
        link_type, args = match_link(url)
        assert link_type is not None and args is not None
        links = [UnfurlableUrl(url=url, args=args)]

        with self.feature(["organizations:dashboards-widget-unfurl"]):
            link_handlers[link_type].fn(self.integration, links, self.user)

        chart_data = mock_generate_chart.call_args[0][1]
        pairs = chart_data["timeSeries"]
        assert [pair[1] for pair in pairs] == [0, 1]
        assert [pair[0]["yAxis"] for pair in pairs] == [
            "count(span.duration)",
            "count(span.duration)",
        ]
        widget_payload = chart_data["widget"]
        assert [q["conditions"] for q in widget_payload["queries"]] == [
            "span.op:db",
            "span.op:http.client",
        ]

    @patch("sentry.integrations.slack.unfurl.dashboards.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_dashboards_single_query_multi_series_share_query_index(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        def grouped_response(group_value: str):
            return {
                "timeSeries": [
                    {
                        "yAxis": "count(span.duration)",
                        "groupBy": [{"key": "transaction", "value": group_value}],
                        "meta": {
                            "valueType": "duration",
                            "valueUnit": "millisecond",
                            "interval": INTERVAL_COUNT * 1000,
                        },
                        "values": [],
                    }
                ],
            }

        mock_client_get.return_value = MagicMock(
            data={
                "timeSeries": [
                    grouped_response("/api/db")["timeSeries"][0],
                    grouped_response("/api/http")["timeSeries"][0],
                ]
            }
        )

        dashboard, _ = self._create_spans_widget(
            aggregates=["count(span.duration)"],
            columns=["transaction"],
        )

        url = (
            f"https://sentry.io/organizations/{self.organization.slug}"
            f"/dashboard/{dashboard.id}/widget/0/?statsPeriod=7d"
        )
        link_type, args = match_link(url)
        assert link_type is not None and args is not None
        links = [UnfurlableUrl(url=url, args=args)]

        with self.feature(["organizations:dashboards-widget-unfurl"]):
            link_handlers[link_type].fn(self.integration, links, self.user)

        chart_data = mock_generate_chart.call_args[0][1]
        pairs = chart_data["timeSeries"]
        assert [pair[1] for pair in pairs] == [0, 0]
        assert [pair[0]["groupBy"][0]["value"] for pair in pairs] == [
            "/api/db",
            "/api/http",
        ]

    @patch("sentry.integrations.slack.unfurl.dashboards.client.get")
    @patch("sentry.charts.backend.generate_chart", return_value="chart-url")
    def test_unfurl_dashboards_bar_display_type(
        self, mock_generate_chart: MagicMock, mock_client_get: MagicMock
    ) -> None:
        mock_client_get.return_value = MagicMock(data=self._build_mock_timeseries_response())
        dashboard, _ = self._create_spans_widget(
            display_type=DashboardWidgetDisplayTypes.BAR_CHART,
        )

        url = (
            f"https://sentry.io/organizations/{self.organization.slug}"
            f"/dashboard/{dashboard.id}/widget/0/?statsPeriod=7d"
        )
        link_type, args = match_link(url)
        assert link_type is not None and args is not None
        links = [UnfurlableUrl(url=url, args=args)]

        with self.feature(["organizations:dashboards-widget-unfurl"]):
            unfurls = link_handlers[link_type].fn(self.integration, links, self.user)

        assert len(unfurls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["widget"]["displayType"] == "bar"

    def test_match_link_dashboards(self) -> None:
        # Primary domain
        link_type, args = match_link(
            "https://sentry.io/organizations/org1/dashboard/1013/widget/1/?statsPeriod=7d"
        )
        assert link_type == LinkType.DASHBOARDS
        assert args is not None
        assert args["org_slug"] == "org1"
        assert args["dashboard_id"] == 1013
        assert args["widget_index"] == 1

        # Customer domain
        link_type, args = match_link(
            "https://org1.sentry.io/dashboard/1013/widget/1/?statsPeriod=7d"
        )
        assert link_type == LinkType.DASHBOARDS
        assert args is not None
        assert args["org_slug"] == "org1"
        assert args["dashboard_id"] == 1013
        assert args["widget_index"] == 1

    def test_match_link_dashboards_widget_builder_is_not_matched(self) -> None:
        # The widget builder route includes /widget-builder/ between /dashboard/
        # and /widget/, which must not be unfurled as a chart.
        link_type, _ = match_link(
            "https://sentry.io/organizations/org1/dashboard/1013/widget-builder/widget/1/edit/"
        )
        assert link_type is None


class BuildWidgetTimeseriesParamsTest(TestCase):
    def _make_widget(
        self,
        widget_type: int = DashboardWidgetTypes.SPANS,
        queries: list[dict[str, Any]] | None = None,
    ):
        dashboard = self.create_dashboard(organization=self.organization)
        widget = self.create_dashboard_widget(
            dashboard=dashboard,
            widget_type=widget_type,
            display_type=DashboardWidgetDisplayTypes.LINE_CHART,
            order=0,
        )
        for i, query in enumerate(queries or [{}]):
            aggregates = query.get("aggregates", ["count(span.duration)"])
            self.create_dashboard_widget_query(
                widget=widget,
                order=i,
                fields=aggregates,
                aggregates=aggregates,
                columns=query.get("columns", []),
                conditions=query.get("conditions", ""),
                orderby=query.get("orderby", ""),
            )
        return widget

    def test_spans_widget(self) -> None:
        widget = self._make_widget(queries=[{"aggregates": ["avg(span.duration)"]}])

        all_params = build_widget_timeseries_params(widget, QueryDict("statsPeriod=7d"))

        assert len(all_params) == 1
        assert all_params[0]["dataset"] == "spans"
        assert all_params[0]["yAxis"] == ["avg(span.duration)"]
        assert all_params[0]["referrer"] == "dashboards.slack.unfurl"
        assert all_params[0]["statsPeriod"] == "7d"

    def test_logs_widget(self) -> None:
        widget = self._make_widget(
            widget_type=DashboardWidgetTypes.LOGS,
            queries=[{"aggregates": ["count(message)"]}],
        )

        all_params = build_widget_timeseries_params(widget, QueryDict("statsPeriod=7d"))

        assert len(all_params) == 1
        assert all_params[0]["dataset"] == "logs"
        assert all_params[0]["yAxis"] == ["count(message)"]

    def test_tracemetrics_widget(self) -> None:
        widget = self._make_widget(
            widget_type=DashboardWidgetTypes.TRACEMETRICS,
            queries=[{"aggregates": ["sum(value)"]}],
        )

        all_params = build_widget_timeseries_params(widget, QueryDict("statsPeriod=7d"))

        assert len(all_params) == 1
        assert all_params[0]["dataset"] == "tracemetrics"
        assert all_params[0]["yAxis"] == ["sum(value)"]

    def test_errors_widget(self) -> None:
        widget = self._make_widget(
            widget_type=DashboardWidgetTypes.ERROR_EVENTS,
            queries=[{"aggregates": ["count()"], "conditions": "level:error"}],
        )

        all_params = build_widget_timeseries_params(widget, QueryDict("statsPeriod=7d"))

        assert len(all_params) == 1
        assert all_params[0]["dataset"] == "errors"
        assert all_params[0]["yAxis"] == ["count()"]
        assert all_params[0]["query"] == "level:error"

    def test_preprod_app_size_widget(self) -> None:
        widget = self._make_widget(
            widget_type=DashboardWidgetTypes.PREPROD_APP_SIZE,
            queries=[{"aggregates": ["max(install_size)"]}],
        )

        all_params = build_widget_timeseries_params(widget, QueryDict("statsPeriod=7d"))

        assert len(all_params) == 1
        assert all_params[0]["dataset"] == "preprodSize"
        assert all_params[0]["yAxis"] == ["max(install_size)"]

    def test_issue_widget(self) -> None:
        widget = self._make_widget(
            widget_type=DashboardWidgetTypes.ISSUE,
            queries=[{"aggregates": ["count(new_issues)"]}],
        )

        all_params = build_widget_timeseries_params(widget, QueryDict("statsPeriod=7d"))

        assert len(all_params) == 1
        # issues-timeseries uses `category` instead of `dataset`
        assert all_params[0]["category"] == "issue"
        assert "dataset" not in all_params[0]
        assert all_params[0]["yAxis"] == ["count(new_issues)"]
        assert all_params[0]["referrer"] == "dashboards.slack.unfurl"
        assert all_params[0]["statsPeriod"] == "7d"

    def test_multiple_queries_returns_one_dict_each_in_order(self) -> None:
        widget = self._make_widget(
            queries=[
                {"aggregates": ["avg(span.duration)"]},
                {"aggregates": ["p75(span.duration)"]},
            ],
        )

        all_params = build_widget_timeseries_params(widget, QueryDict("statsPeriod=7d"))

        assert [p["yAxis"] for p in all_params] == [
            ["avg(span.duration)"],
            ["p75(span.duration)"],
        ]

    def test_groupby_sets_top_events_and_default_sort(self) -> None:
        widget = self._make_widget(
            queries=[{"aggregates": ["avg(span.duration)"], "columns": ["span.op"]}],
        )

        params = build_widget_timeseries_params(widget, QueryDict("statsPeriod=7d"))[0]

        assert params["groupBy"] == ["span.op"]
        assert params["topEvents"] == "5"
        # Default descending by the first yAxis when grouping without an explicit sort
        assert params["sort"] == "-avg(span.duration)"

    def test_explicit_orderby_wins_over_default(self) -> None:
        widget = self._make_widget(
            queries=[
                {
                    "aggregates": ["avg(span.duration)"],
                    "columns": ["span.op"],
                    "orderby": "span.op",
                }
            ],
        )

        params = build_widget_timeseries_params(widget, QueryDict("statsPeriod=7d"))[0]

        assert params["sort"] == "span.op"

    def test_conditions_become_query(self) -> None:
        widget = self._make_widget(
            queries=[{"aggregates": ["avg(span.duration)"], "conditions": "span.op:http"}],
        )

        params = build_widget_timeseries_params(widget, QueryDict("statsPeriod=7d"))[0]

        assert params["query"] == "span.op:http"

    def test_multi_valued_aggregates_and_columns_preserved_as_lists(self) -> None:
        # client.get uses isinstance(value, list) to call setlist — the helper
        # must return lists (not a QueryDict, not scalar strings) for
        # multi-valued params.
        widget = self._make_widget(
            queries=[
                {
                    "aggregates": ["avg(span.duration)", "p75(span.duration)"],
                    "columns": ["span.op", "span.category"],
                }
            ],
        )

        params = build_widget_timeseries_params(widget, QueryDict("statsPeriod=7d"))[0]

        assert params["yAxis"] == ["avg(span.duration)", "p75(span.duration)"]
        assert params["groupBy"] == ["span.op", "span.category"]

    def test_url_params_forwarded(self) -> None:
        widget = self._make_widget()

        params = build_widget_timeseries_params(
            widget, QueryDict("statsPeriod=24h&project=1&project=2&environment=prod")
        )[0]

        assert params["statsPeriod"] == "24h"
        assert params["project"] == ["1", "2"]
        assert params["environment"] == "prod"

    def test_default_stats_period_when_absent(self) -> None:
        widget = self._make_widget()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        # Matches DEFAULT_STATS_PERIOD in static/app/views/dashboards/data.tsx
        assert params["statsPeriod"] == "24h"

    def test_url_start_end_supersedes_default_stats_period(self) -> None:
        widget = self._make_widget()

        params = build_widget_timeseries_params(
            widget, QueryDict("start=2026-01-01T00:00:00&end=2026-01-02T00:00:00")
        )[0]

        assert "statsPeriod" not in params
        assert params["start"] == "2026-01-01T00:00:00"
        assert params["end"] == "2026-01-02T00:00:00"

    def test_omits_project_when_no_url_or_dashboard_project(self) -> None:
        widget = self._make_widget()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        # Omitting the param matches the dashboard FE: the API defaults to
        # "My Projects" rather than "All Projects" (project=-1).
        assert "project" not in params

    def test_dashboard_projects_used_when_url_missing(self) -> None:
        project_a = self.create_project(organization=self.organization)
        project_b = self.create_project(organization=self.organization)
        widget = self._make_widget()
        widget.dashboard.projects.set([project_a, project_b])

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert sorted(params["project"]) == sorted([str(project_a.id), str(project_b.id)])

    def test_dashboard_all_projects_flag_maps_to_sentinel(self) -> None:
        widget = self._make_widget()
        widget.dashboard.filters = {"all_projects": True}
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert params["project"] == "-1"

    def test_url_project_overrides_dashboard_projects(self) -> None:
        project_a = self.create_project(organization=self.organization)
        widget = self._make_widget()
        widget.dashboard.projects.set([project_a])

        params = build_widget_timeseries_params(widget, QueryDict("project=99"))[0]

        assert params["project"] == "99"

    def test_dashboard_environment_used_when_url_missing(self) -> None:
        widget = self._make_widget()
        widget.dashboard.filters = {"environment": ["prod", "staging"]}
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert params["environment"] == ["prod", "staging"]

    def test_url_environment_overrides_dashboard_environment(self) -> None:
        widget = self._make_widget()
        widget.dashboard.filters = {"environment": ["prod"]}
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict("environment=dev"))[0]

        assert params["environment"] == "dev"

    def test_dashboard_period_used_when_url_missing(self) -> None:
        widget = self._make_widget()
        widget.dashboard.filters = {"period": "7d"}
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert params["statsPeriod"] == "7d"

    def test_dashboard_start_end_used_when_url_missing(self) -> None:
        widget = self._make_widget()
        widget.dashboard.filters = {
            "start": "2026-01-01T00:00:00",
            "end": "2026-01-02T00:00:00",
            "utc": True,
        }
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert "statsPeriod" not in params
        assert params["start"] == "2026-01-01T00:00:00"
        assert params["end"] == "2026-01-02T00:00:00"
        # utc is intentionally dropped - not consumed by events-timeseries and
        # irrelevant for a cross-timezone Slack audience.
        assert "utc" not in params

    def test_url_period_supersedes_dashboard_start_end(self) -> None:
        # When the URL carries any date info, the dashboard's date range is
        # ignored entirely so we don't mix URL statsPeriod with a saved range.
        widget = self._make_widget()
        widget.dashboard.filters = {
            "start": "2026-01-01T00:00:00",
            "end": "2026-01-02T00:00:00",
        }
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict("statsPeriod=7d"))[0]

        assert params["statsPeriod"] == "7d"
        assert "start" not in params
        assert "end" not in params

    def test_dashboard_release_filter_appended_to_query(self) -> None:
        widget = self._make_widget()
        widget.dashboard.filters = {"release": ["v1.0.0"]}
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert params["query"] == 'release:"v1.0.0"'

    def test_dashboard_release_multiple_values_use_list_syntax(self) -> None:
        widget = self._make_widget()
        widget.dashboard.filters = {"release": ["v1.0.0", "v2.0.0"]}
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert params["query"] == 'release:["v1.0.0","v2.0.0"]'

    def test_dashboard_release_combined_with_widget_conditions(self) -> None:
        widget = self._make_widget(
            queries=[{"aggregates": ["avg(span.duration)"], "conditions": "span.op:http"}],
        )
        widget.dashboard.filters = {"release": ["v1.0.0"]}
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        # Widget conditions are wrapped in parens, then global filters appended.
        assert params["query"] == '(span.op:http) release:"v1.0.0"'

    def test_url_release_overrides_dashboard_release(self) -> None:
        widget = self._make_widget()
        widget.dashboard.filters = {"release": ["v1.0.0"]}
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict("release=v2.0.0"))[0]

        assert params["query"] == 'release:"v2.0.0"'

    def test_url_release_multiple_values(self) -> None:
        widget = self._make_widget()

        params = build_widget_timeseries_params(widget, QueryDict("release=v1.0.0&release=v2.0.0"))[
            0
        ]

        assert params["query"] == 'release:["v1.0.0","v2.0.0"]'

    def test_url_empty_release_falls_back_to_dashboard_release(self) -> None:
        widget = self._make_widget()
        widget.dashboard.filters = {"release": ["v1.0.0"]}
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict("release="))[0]

        assert params["query"] == 'release:"v1.0.0"'

    def test_url_empty_release_with_no_dashboard_release_omits_query(self) -> None:
        widget = self._make_widget()

        params = build_widget_timeseries_params(widget, QueryDict("release="))[0]

        assert "query" not in params

    def test_url_empty_project_falls_back_to_dashboard_projects(self) -> None:
        project_a = self.create_project(organization=self.organization)
        widget = self._make_widget()
        widget.dashboard.projects.set([project_a])

        params = build_widget_timeseries_params(widget, QueryDict("project="))[0]

        assert params["project"] == str(project_a.id)

    def test_url_empty_environment_falls_back_to_dashboard_environment(self) -> None:
        widget = self._make_widget()
        widget.dashboard.filters = {"environment": ["prod"]}
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict("environment="))[0]

        assert params["environment"] == "prod"

    def test_dashboard_global_filter_applied_when_dataset_matches(self) -> None:
        widget = self._make_widget(widget_type=DashboardWidgetTypes.SPANS)
        widget.dashboard.filters = {
            "global_filter": [
                {"dataset": "spans", "tag": {"key": "span.op"}, "value": "span.op:http"},
            ],
        }
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert params["query"] == "span.op:http"

    def test_dashboard_global_filter_skipped_when_dataset_mismatches(self) -> None:
        widget = self._make_widget(widget_type=DashboardWidgetTypes.LOGS)
        widget.dashboard.filters = {
            "global_filter": [
                {"dataset": "spans", "tag": {"key": "span.op"}, "value": "span.op:http"},
            ],
        }
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert "query" not in params

    def test_dashboard_global_filter_multiple_entries_joined_with_space(self) -> None:
        widget = self._make_widget(widget_type=DashboardWidgetTypes.SPANS)
        widget.dashboard.filters = {
            "global_filter": [
                {"dataset": "spans", "tag": {"key": "span.op"}, "value": "span.op:http"},
                {"dataset": "spans", "tag": {"key": "env"}, "value": "env:prod"},
                {"dataset": "logs", "tag": {"key": "level"}, "value": "level:error"},
            ],
        }
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert params["query"] == "span.op:http env:prod"

    def test_release_and_global_filter_combined(self) -> None:
        widget = self._make_widget(widget_type=DashboardWidgetTypes.SPANS)
        widget.dashboard.filters = {
            "release": ["v1.0.0"],
            "global_filter": [
                {"dataset": "spans", "tag": {"key": "span.op"}, "value": "span.op:http"},
            ],
        }
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert params["query"] == 'release:"v1.0.0" span.op:http'

    def test_url_global_filter_overrides_dashboard_global_filter(self) -> None:
        widget = self._make_widget(widget_type=DashboardWidgetTypes.SPANS)
        widget.dashboard.filters = {
            "global_filter": [
                {"dataset": "spans", "tag": {"key": "span.op"}, "value": "span.op:http"},
            ],
        }
        widget.dashboard.save()

        url_filter = '{"dataset": "spans", "tag": {"key": "env"}, "value": "env:prod"}'
        params = build_widget_timeseries_params(widget, QueryDict(f"globalFilter={url_filter}"))[0]

        assert params["query"] == "env:prod"

    def test_url_empty_global_filter_falls_back_to_dashboard_global_filter(self) -> None:
        widget = self._make_widget(widget_type=DashboardWidgetTypes.SPANS)
        widget.dashboard.filters = {
            "global_filter": [
                {"dataset": "spans", "tag": {"key": "span.op"}, "value": "span.op:http"},
            ],
        }
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict("globalFilter="))[0]

        assert params["query"] == "span.op:http"

    def test_url_global_filter_invalid_json_is_skipped(self) -> None:
        widget = self._make_widget(widget_type=DashboardWidgetTypes.SPANS)

        url_filter = '{"dataset": "spans", "tag": {"key": "env"}, "value": "env:prod"}'
        params = build_widget_timeseries_params(
            widget, QueryDict(f"globalFilter=not-json&globalFilter={url_filter}")
        )[0]

        assert params["query"] == "env:prod"

    def test_global_filter_for_error_events_widget(self) -> None:
        widget = self._make_widget(
            widget_type=DashboardWidgetTypes.ERROR_EVENTS,
            queries=[{"aggregates": ["count()"]}],
        )
        widget.dashboard.filters = {
            "global_filter": [
                {"dataset": "error-events", "tag": {"key": "level"}, "value": "level:error"},
            ],
        }
        widget.dashboard.save()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert params["query"] == "level:error"

    def test_no_dashboard_filters_no_widget_conditions_omits_query(self) -> None:
        widget = self._make_widget()

        params = build_widget_timeseries_params(widget, QueryDict())[0]

        assert "query" not in params
