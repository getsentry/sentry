from unittest.mock import patch

import pytest
from django.http.request import QueryDict
from django.test import RequestFactory

from sentry.charts.types import ChartType
from sentry.discover.models import DiscoverSavedQuery
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models import IncidentStatus
from sentry.integrations.slack.message_builder.discover import SlackDiscoverMessageBuilder
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
from sentry.integrations.slack.unfurl import LinkType, UnfurlableUrl, link_handlers, match_link
from sentry.testutils import TestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.helpers.datetime import before_now, iso_format


@pytest.mark.parametrize(
    "url,expected",
    [
        ("http://invalid_link", (None, None)),
        (
            "https://sentry.io/organizations/org1/issues/12345/",
            (LinkType.ISSUES, {"issue_id": 12345, "event_id": None}),
        ),
        (
            "https://sentry.io/organizations/org1/alerts/rules/details/12345/",
            (LinkType.INCIDENTS, {"incident_id": 12345, "org_slug": "org1"}),
        ),
        (
            "https://sentry.io/organizations/org1/discover/results/?project=1&yAxis=count()",
            (
                LinkType.DISCOVER,
                {"org_slug": "org1", "query": QueryDict("project=1&yAxis=count()")},
            ),
        ),
    ],
)
def test_match_link(url, expected):
    assert match_link(url) == expected


class UnfurlTest(TestCase):
    def setUp(self):
        super().setUp()
        self.integration = install_slack(self.organization)

        self.request = RequestFactory().get("slack/event")

    def test_unfurl_issues(self):
        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )
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

        unfurls = link_handlers[LinkType.ISSUES].fn(self.request, self.integration, links)

        assert unfurls[links[0].url] == SlackIssuesMessageBuilder(self.group).build()
        assert (
            unfurls[links[1].url]
            == SlackIssuesMessageBuilder(group2, event, link_to_event=True).build()
        )

    def test_unfurl_incidents(self):
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
                url=f"https://sentry.io/organizations/{self.organization.slug}/alerts/rules/details/{incident.identifier}/",
                args={"org_slug": self.organization.slug, "incident_id": incident.identifier},
            ),
        ]
        unfurls = link_handlers[LinkType.INCIDENTS].fn(self.request, self.integration, links)

        assert (
            unfurls[links[0].url]
            == SlackIncidentsMessageBuilder(incident, IncidentStatus.CLOSED).build()
        )

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_unfurl_discover(self, mock_generate_chart):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&project={self.project.id}&query=&sort=-timestamp&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise Exception("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:discover-basic"]):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count()"
        assert len(chart_data["stats"]["data"]) == 288

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_unfurl_discover_previous_period(self, mock_generate_chart):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?display=previous&field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&project={self.project.id}&query=&sort=-timestamp&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise Exception("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:discover-basic"]):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links, self.user)

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

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_unfurl_discover_multi_y_axis(self, mock_generate_chart):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&project={self.project.id}&query=&sort=-timestamp&statsPeriod=24h&yAxis=count_unique%28user%29&yAxis=count%28%29"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise Exception("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:discover-basic"]):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]

        assert len(chart_data["stats"]["count()"]["data"]) == 288
        assert len(chart_data["stats"]["count_unique(user)"]["data"]) == 288

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_unfurl_discover_html_escaped(self, mock_generate_chart):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?field=title&amp;field=event.type&amp;field=project&amp;field=user.display&amp;field=timestamp&amp;name=All+Events&amp;project={self.project.id}&amp;query=&amp;sort=-timestamp&amp;statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise Exception("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:discover-basic"]):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count()"
        assert len(chart_data["stats"]["data"]) == 288

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_unfurl_discover_short_url(self, mock_generate_chart):
        query = {
            "fields": ["message", "event.type", "project", "user.display", "count_unique(user)"],
            "query": "message:[first,second]",
            "yAxis": "count_unique(user)",
            "display": "top5",
            "topEvents": 2,
        }
        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.organization,
            created_by=self.user,
            name="Test query",
            query=query,
            version=2,
        )
        saved_query.set_projects([self.project.id])

        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"message": "first", "fingerprint": ["group2"], "timestamp": min_ago},
            project_id=self.project.id,
        )
        self.store_event(
            data={"message": "second", "fingerprint": ["group2"], "timestamp": min_ago},
            project_id=self.project.id,
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?id={saved_query.id}&statsPeriod=24h&project={self.project.id}"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise Exception("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links, self.user)

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
        assert len(chart_data["stats"][first_key]["data"]) == 288

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_unfurl_correct_y_axis_for_saved_query(self, mock_generate_chart):
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
            created_by=self.user,
            name="Test query",
            query=query,
            version=2,
        )
        saved_query.set_projects([self.project.id])

        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"message": "first", "fingerprint": ["group2"], "timestamp": min_ago},
            project_id=self.project.id,
        )
        self.store_event(
            data={"message": "second", "fingerprint": ["group2"], "timestamp": min_ago},
            project_id=self.project.id,
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?id={saved_query.id}&statsPeriod=24h&project={self.project.id}"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise Exception("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links, self.user)

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
        assert len(chart_data["stats"]["data"]) == 288

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_top_events_url_param(self, mock_generate_chart):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"message": "first", "fingerprint": ["group1"], "timestamp": min_ago},
            project_id=self.project.id,
        )
        self.store_event(
            data={"message": "second", "fingerprint": ["group2"], "timestamp": min_ago},
            project_id=self.project.id,
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?field=message&field=event.type&field=count()&name=All+Events&query=message:[first,second]&sort=-count&statsPeriod=24h&display=top5&topEvents=2"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise Exception("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links, self.user)

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
        assert len(chart_data["stats"][first_key]["data"]) == 288

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_top_daily_events_renders_bar_chart(self, mock_generate_chart):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"message": "first", "fingerprint": ["group1"], "timestamp": min_ago},
            project_id=self.project.id,
        )
        self.store_event(
            data={"message": "second", "fingerprint": ["group2"], "timestamp": min_ago},
            project_id=self.project.id,
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?field=message&field=event.type&field=count()&name=All+Events&query=message:[first,second]&sort=-count&statsPeriod=24h&display=dailytop5&topEvents=2"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise Exception("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links, self.user)

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

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_unfurl_discover_short_url_without_project_ids(self, mock_generate_chart):
        query = {
            "fields": ["title", "event.type", "project", "user.display", "timestamp"],
            "query": "",
            "yAxis": "count_unique(users)",
        }
        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.organization,
            created_by=self.user,
            name="Test query",
            query=query,
            version=2,
        )
        saved_query.set_projects([self.project.id])

        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?id={saved_query.id}&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise Exception("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links, self.user)

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
        assert len(chart_data["stats"]["data"]) == 288

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_unfurl_discover_without_project_ids(self, mock_generate_chart):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=self.project.id
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&query=&sort=-timestamp&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise Exception("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover",
                "organizations:discover-basic",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count()"
        assert len(chart_data["stats"]["data"]) == 288

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_unfurl_world_map(self, mock_generate_chart):
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={
                "fingerprint": ["group2"],
                "timestamp": min_ago,
                "user": {"geo": {"country_code": "CA", "region": "Canada"}},
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                "fingerprint": ["group2"],
                "timestamp": min_ago,
                "user": {"geo": {"country_code": "AU", "region": "Australia"}},
            },
            project_id=self.project.id,
        )

        url = f"https://sentry.io/organizations/{self.organization.slug}/discover/results/?display=worldmap&field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&project={self.project.id}&query=&sort=-timestamp&statsPeriod=24h&yAxis=count%28%29"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise Exception("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(["organizations:discover-basic"]):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links, self.user)

        assert (
            unfurls[url]
            == SlackDiscoverMessageBuilder(
                title=args["query"].get("name"), chart_url="chart-url"
            ).build()
        )
        assert len(mock_generate_chart.mock_calls) == 1

        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_DISCOVER_WORLDMAP
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count()"
        assert len(chart_data["stats"]["data"]) == 2
        assert sorted(x["geo.country_code"] for x in chart_data["stats"]["data"]) == ["AU", "CA"]
