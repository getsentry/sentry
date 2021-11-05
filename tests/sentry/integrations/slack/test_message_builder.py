from django.urls import reverse

from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.integrations.slack.message_builder import LEVEL_TO_COLOR
from sentry.integrations.slack.message_builder.incidents import SlackIncidentsMessageBuilder
from sentry.integrations.slack.message_builder.issues import SlackIssuesMessageBuilder
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
        assert SlackIncidentsMessageBuilder(incident, action).build() == {
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

        # This test will use the action/method and not the incident to build status
        title = f"Critical: {alert_rule.name}"
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
        assert SlackIncidentsMessageBuilder(
            incident, action, metric_value=metric_value, method="fire"
        ).build() == {
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
        assert SlackIssuesMessageBuilder(group).build() == {
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
                    "selected_options": [],
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
        assert SlackIssuesMessageBuilder(group, event).build() == {
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
                    "selected_options": [],
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

        assert SlackIssuesMessageBuilder(group, event, link_to_event=True).build() == {
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
                    "selected_options": [],
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
        assert (
            SlackIssuesMessageBuilder(issue_alert_group, issue_details=True).build()["actions"]
            == []
        )

    def test_build_group_attachment_color_no_event_error_fallback(self):
        group_with_no_events = self.create_group(project=self.project)
        assert SlackIssuesMessageBuilder(group_with_no_events).build()["color"] == "#E03E2F"

    def test_build_group_attachment_color_unexpected_level_error_fallback(self):
        unexpected_level_event = self.store_event(
            data={"level": "trace"}, project_id=self.project.id, assert_no_errors=False
        )
        assert SlackIssuesMessageBuilder(unexpected_level_event.group).build()["color"] == "#E03E2F"

    def test_build_group_attachment_color_warning(self):
        warning_event = self.store_event(data={"level": "warning"}, project_id=self.project.id)
        assert SlackIssuesMessageBuilder(warning_event.group).build()["color"] == "#FFC227"
        assert (
            SlackIssuesMessageBuilder(warning_event.group, warning_event).build()["color"]
            == "#FFC227"
        )
