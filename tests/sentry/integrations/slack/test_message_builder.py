from django.urls import reverse

from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.integrations.slack.message_builder import LEVEL_TO_COLOR
from sentry.integrations.slack.message_builder.incidents import build_incident_attachment
from sentry.integrations.slack.message_builder.issues import build_group_attachment
from sentry.integrations.slack.utils import parse_link
from sentry.testutils import TestCase
from sentry.utils.assets import get_asset_url
from sentry.utils.dates import to_timestamp
from sentry.utils.http import absolute_uri


class BuildIncidentAttachmentTest(TestCase):
    def test_simple(self):
        logo_url = absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=2)
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Resolved: {alert_rule.name}"
        incident_footer_ts = (
            "<!date^{:.0f}^Sentry Incident - Started {} at {} | Sentry Incident>".format(
                to_timestamp(incident.date_started), "{date_pretty}", "{time}"
            )
        )
        assert build_incident_attachment(action, incident) == {
            "fallback": title,
            "title": title,
            "title_link": absolute_uri(
                reverse(
                    "sentry-metric-alert",
                    kwargs={
                        "organization_slug": incident.organization.slug,
                        "incident_id": incident.identifier,
                    },
                )
            ),
            "text": "0 events in the last 10 minutes\nFilter: level:error",
            "fields": [],
            "mrkdwn_in": ["text"],
            "footer_icon": logo_url,
            "footer": incident_footer_ts,
            "color": LEVEL_TO_COLOR["_incident_resolved"],
            "actions": [],
        }

    def test_metric_value(self):
        logo_url = absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=2)
        title = f"Critical: {alert_rule.name}"  # This test will use the action/method and not the incident to build status
        metric_value = 5000
        trigger = self.create_alert_rule_trigger(alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        incident_footer_ts = (
            "<!date^{:.0f}^Sentry Incident - Started {} at {} | Sentry Incident>".format(
                to_timestamp(incident.date_started), "{date_pretty}", "{time}"
            )
        )
        # This should fail because it pulls status from `action` instead of `incident`
        assert build_incident_attachment(
            action, incident, metric_value=metric_value, method="fire"
        ) == {
            "fallback": title,
            "title": title,
            "title_link": absolute_uri(
                reverse(
                    "sentry-metric-alert",
                    kwargs={
                        "organization_slug": incident.organization.slug,
                        "incident_id": incident.identifier,
                    },
                )
            ),
            "text": f"{metric_value} events in the last 10 minutes\nFilter: level:error",
            "fields": [],
            "mrkdwn_in": ["text"],
            "footer_icon": logo_url,
            "footer": incident_footer_ts,
            "color": LEVEL_TO_COLOR["fatal"],
            "actions": [],
        }

    def test_build_group_attachment(self):
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(
            organization=self.org, teams=[self.team], name="Bengal-Elephant-Giraffe-Tree-House"
        )
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        group = self.create_group(project=self.project)
        ts = group.last_seen
        assert build_group_attachment(group) == {
            "text": "",
            "color": "#E03E2F",
            "actions": [
                {"name": "status", "text": "Resolve", "type": "button", "value": "resolved"},
                {"text": "Ignore", "type": "button", "name": "status", "value": "ignored"},
                {
                    "option_groups": [
                        {
                            "text": "Teams",
                            "options": [
                                {
                                    "text": "#mariachi-band",
                                    "value": "team:" + str(self.team.id),
                                }
                            ],
                        },
                        {
                            "text": "People",
                            "options": [
                                {
                                    "text": "foo@example.com",
                                    "value": "user:" + str(self.user.id),
                                }
                            ],
                        },
                    ],
                    "text": "Select Assignee...",
                    "selected_options": [None],
                    "type": "select",
                    "name": "assign",
                },
            ],
            "mrkdwn_in": ["text"],
            "title": group.title,
            "fields": [],
            "footer": "BENGAL-ELEPHANT-GIRAFFE-TREE-HOUSE-1",
            "ts": to_timestamp(ts),
            "title_link": "http://testserver/organizations/rowdy-tiger/issues/"
            + str(group.id)
            + "/?referrer=slack",
            "callback_id": '{"issue":' + str(group.id) + "}",
            "fallback": f"[{self.project.slug}] {group.title}",
            "footer_icon": "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png",
        }
        event = self.store_event(data={}, project_id=self.project.id)
        ts = event.datetime
        assert build_group_attachment(group, event) == {
            "color": "#E03E2F",
            "text": "",
            "actions": [
                {"name": "status", "text": "Resolve", "type": "button", "value": "resolved"},
                {"text": "Ignore", "type": "button", "name": "status", "value": "ignored"},
                {
                    "option_groups": [
                        {
                            "text": "Teams",
                            "options": [
                                {
                                    "text": "#mariachi-band",
                                    "value": "team:" + str(self.team.id),
                                }
                            ],
                        },
                        {
                            "text": "People",
                            "options": [
                                {
                                    "text": "foo@example.com",
                                    "value": "user:" + str(self.user.id),
                                }
                            ],
                        },
                    ],
                    "text": "Select Assignee...",
                    "selected_options": [None],
                    "type": "select",
                    "name": "assign",
                },
            ],
            "mrkdwn_in": ["text"],
            "title": event.title,
            "fields": [],
            "footer": "BENGAL-ELEPHANT-GIRAFFE-TREE-HOUSE-1",
            "ts": to_timestamp(ts),
            "title_link": "http://testserver/organizations/rowdy-tiger/issues/"
            + str(group.id)
            + "/?referrer=slack",
            "callback_id": '{"issue":' + str(group.id) + "}",
            "fallback": f"[{self.project.slug}] {event.title}",
            "footer_icon": "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png",
        }

        assert build_group_attachment(group, event, link_to_event=True) == {
            "color": "#E03E2F",
            "text": "",
            "actions": [
                {"name": "status", "text": "Resolve", "type": "button", "value": "resolved"},
                {"text": "Ignore", "type": "button", "name": "status", "value": "ignored"},
                {
                    "option_groups": [
                        {
                            "text": "Teams",
                            "options": [
                                {
                                    "text": "#mariachi-band",
                                    "value": "team:" + str(self.team.id),
                                }
                            ],
                        },
                        {
                            "text": "People",
                            "options": [
                                {
                                    "text": "foo@example.com",
                                    "value": "user:" + str(self.user.id),
                                }
                            ],
                        },
                    ],
                    "text": "Select Assignee...",
                    "selected_options": [None],
                    "type": "select",
                    "name": "assign",
                },
            ],
            "mrkdwn_in": ["text"],
            "title": event.title,
            "fields": [],
            "footer": "BENGAL-ELEPHANT-GIRAFFE-TREE-HOUSE-1",
            "ts": to_timestamp(ts),
            "title_link": f"http://testserver/organizations/rowdy-tiger/issues/{group.id}/events/{event.event_id}/"
            + "?referrer=slack",
            "callback_id": '{"issue":' + str(group.id) + "}",
            "fallback": f"[{self.project.slug}] {event.title}",
            "footer_icon": "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png",
        }

    def test_build_group_attachment_issue_alert(self):
        issue_alert_group = self.create_group(project=self.project)
        assert build_group_attachment(issue_alert_group, issue_details=True)["actions"] == []

    def test_build_group_attachment_color_no_event_error_fallback(self):
        group_with_no_events = self.create_group(project=self.project)
        assert build_group_attachment(group_with_no_events)["color"] == "#E03E2F"

    def test_build_group_attachment_color_unexpected_level_error_fallback(self):
        unexpected_level_event = self.store_event(
            data={"level": "trace"}, project_id=self.project.id, assert_no_errors=False
        )
        assert build_group_attachment(unexpected_level_event.group)["color"] == "#E03E2F"

    def test_build_group_attachment_color_warning(self):
        warning_event = self.store_event(data={"level": "warning"}, project_id=self.project.id)
        assert build_group_attachment(warning_event.group)["color"] == "#FFC227"
        assert build_group_attachment(warning_event.group, warning_event)["color"] == "#FFC227"

    def test_parse_link(self):
        link = "https://meowlificent.ngrok.io/organizations/sentry/issues/167/?project=2&query=is%3Aunresolved"
        link2 = "https://meowlificent.ngrok.io/organizations/sentry/issues/1/events/2d113519854c4f7a85bae8b69c7404ad/?project=2"
        link3 = "https://meowlificent.ngrok.io/organizations/sentry/issues/9998089891/events/198e93sfa99d41b993ac8ae5dc384642/events/"
        assert (
            parse_link(link)
            == "organizations/{organization}/issues/{issue_id}/project=%7Bproject%7D&query=%5B%27is%3Aunresolved%27%5D"
        )
        assert (
            parse_link(link2)
            == "organizations/{organization}/issues/{issue_id}/events/{event_id}/project=%7Bproject%7D"
        )
        assert (
            parse_link(link3)
            == "organizations/{organization}/issues/{issue_id}/events/{event_id}/events/"
        )
