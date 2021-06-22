import pytest
from django.http.request import QueryDict
from django.test import RequestFactory

from sentry.charts.types import ChartType
from sentry.discover.models import DiscoverSavedQuery
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.integrations.slack.message_builder.discover import build_discover_attachment
from sentry.integrations.slack.message_builder.incidents import build_incident_attachment
from sentry.integrations.slack.message_builder.issues import build_group_attachment
from sentry.integrations.slack.unfurl import LinkType, UnfurlableUrl, link_handlers, match_link
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.utils.compat.mock import patch


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
        self.request = RequestFactory().get("slack/event")
        self.user = self.create_user(is_superuser=False)
        self.org = self.create_organization(owner=None)
        self.integration = Integration.objects.create(
            provider="slack",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        OrganizationIntegration.objects.create(organization=self.org, integration=self.integration)

    def test_unfurl_issues(self):
        project1 = self.create_project(organization=self.org)
        group1 = self.create_group(project=project1)
        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=project1.id
        )
        group2 = event.group

        links = [
            UnfurlableUrl(
                url=f"https://sentry.io/organizations/{self.org.slug}/issues/{group1.id}/",
                args={"issue_id": group1.id, "event_id": None},
            ),
            UnfurlableUrl(
                url=f"https://sentry.io/organizations/{self.org.slug}/issues/{group2.id}/{event.event_id}/",
                args={"issue_id": group2.id, "event_id": event.event_id},
            ),
        ]

        unfurls = link_handlers[LinkType.ISSUES].fn(self.request, self.integration, links)

        assert unfurls[links[0].url] == build_group_attachment(group1)
        assert unfurls[links[1].url] == build_group_attachment(group2, event, link_to_event=True)

    def test_unfurl_incidents(self):
        project1 = self.create_project(organization=self.org)
        alert_rule = self.create_alert_rule()

        incident = self.create_incident(
            status=2, organization=self.org, projects=[project1], alert_rule=alert_rule
        )
        incident.update(identifier=123)
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )

        links = [
            UnfurlableUrl(
                url=f"https://sentry.io/organizations/{self.org.slug}/alerts/rules/details/{incident.identifier}/",
                args={"org_slug": self.org.slug, "incident_id": incident.identifier},
            ),
        ]
        unfurls = link_handlers[LinkType.INCIDENTS].fn(self.request, self.integration, links)

        assert unfurls[links[0].url] == build_incident_attachment(action, incident)

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_unfurl_discover(self, mock_generate_chart):
        project1 = self.create_project(organization=self.org)
        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=project1.id
        )
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=project1.id
        )

        url = f"https://sentry.io/organizations/{self.org.slug}/discover/results/?field=title&field=event.type&field=project&field=user.display&field=timestamp&name=All+Events&project={project1.id}&query=&sort=-timestamp&statsPeriod=24h"
        link_type, args = match_link(url)

        if not args or not link_type:
            raise Exception("Missing link_type/args")

        links = [
            UnfurlableUrl(url=url, args=args),
        ]

        with self.feature(
            [
                "organizations:discover-basic",
                "organizations:chart-unfurls",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links)

        assert unfurls[url] == build_discover_attachment(
            title=args["query"].get("name"), chart_url="chart-url"
        )
        assert len(mock_generate_chart.mock_calls) == 1
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count()"
        assert len(chart_data["stats"]["data"]) == 288

    @patch("sentry.integrations.slack.unfurl.discover.generate_chart", return_value="chart-url")
    def test_unfurl_discover_short_url(self, mock_generate_chart):
        query = {
            "fields": ["title", "event.type", "project", "user.display", "timestamp"],
            "query": "",
            "yAxis": "count_unique(users)",
        }
        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.org, created_by=self.user, name="Test query", query=query, version=2
        )
        project1 = self.create_project(organization=self.org)
        saved_query.set_projects([project1.id])

        min_ago = iso_format(before_now(minutes=1))
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=project1.id
        )
        self.store_event(
            data={"fingerprint": ["group2"], "timestamp": min_ago}, project_id=project1.id
        )

        url = f"https://sentry.io/organizations/{self.org.slug}/discover/results/?id={saved_query.id}&statsPeriod=24h&project={project1.id}"
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
                "organizations:chart-unfurls",
            ]
        ):
            unfurls = link_handlers[link_type].fn(self.request, self.integration, links)

        assert unfurls[url] == build_discover_attachment(
            title=args["query"].get("name"), chart_url="chart-url"
        )
        assert len(mock_generate_chart.mock_calls) == 1

        assert mock_generate_chart.call_args[0][0] == ChartType.SLACK_DISCOVER_TOTAL_PERIOD
        chart_data = mock_generate_chart.call_args[0][1]
        assert chart_data["seriesName"] == "count_unique(users)"
        assert len(chart_data["stats"]["data"]) == 288
