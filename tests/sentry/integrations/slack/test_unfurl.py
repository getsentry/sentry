import pytest
from django.test import RequestFactory

from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.integrations.slack.message_builder.incidents import build_incident_attachment
from sentry.integrations.slack.message_builder.issues import build_group_attachment
from sentry.integrations.slack.unfurl import LinkType, UnfurlableUrl, link_handlers, match_link
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import TestCase
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

        project1 = self.create_project(organization=self.org)
        alert_rule = self.create_alert_rule()

        # Setup incident to be unfurled
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
