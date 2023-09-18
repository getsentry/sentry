from __future__ import annotations

from datetime import datetime
from typing import Any

from django.urls import reverse

from sentry.eventstore.models import Event
from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models import IncidentStatus
from sentry.integrations.discord.message_builder import LEVEL_TO_COLOR
from sentry.integrations.discord.message_builder.metric_alerts import (
    DiscordMetricAlertMessageBuilder,
)
from sentry.models import Group, Team, User
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.dates import to_timestamp
from sentry.utils.http import absolute_uri


def build_test_message(
    teams: set[Team],
    users: set[User],
    timestamp: datetime,
    group: Group,
    event: Event | None = None,
    link_to_event: bool = False,
) -> dict[str, Any]:
    project = group.project

    title = group.title
    title_link = f"http://testserver/organizations/{project.organization.slug}/issues/{group.id}"
    if event:
        title = event.title
        if link_to_event:
            title_link += f"/events/{event.event_id}"
    title_link += "/?referrer=discord"

    return {
        "text": "",
        "color": "#E03E2F",  # red for error level
        "actions": [
            {"name": "status", "text": "Resolve", "type": "button", "value": "resolved"},
            {"name": "status", "text": "Ignore", "type": "button", "value": "ignored:forever"},
            {
                "option_groups": [
                    {
                        "text": "Teams",
                        "options": [
                            {"text": f"#{team.slug}", "value": f"team:{team.id}"} for team in teams
                        ],
                    },
                    {
                        "text": "People",
                        "options": [
                            {
                                "text": user.email,
                                "value": f"user:{user.id}",
                            }
                            for user in users
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
        "title": title,
        "fields": [],
        "footer": f"{project.slug.upper()}-1",
        "ts": to_timestamp(timestamp),
        "title_link": title_link,
        "callback_id": '{"issue":' + str(group.id) + "}",
        "fallback": f"[{project.slug}] {title}",
        "footer_icon": "http://testserver/_static/{version}/sentry/images/sentry-email-avatar.png",
    }


@region_silo_test(stable=True)
class BuildMetricAlertAttachmentTest(TestCase):
    def setUp(self):
        super().setUp()
        self.alert_rule = self.create_alert_rule()

    def test_metric_alert_without_incidents(self):
        title = f"Resolved: {self.alert_rule.name}"
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": self.alert_rule.organization.slug,
                    "alert_rule_id": self.alert_rule.id,
                },
            )
        )
        assert DiscordMetricAlertMessageBuilder(self.alert_rule).build() == {
            "content": "",
            "embeds": [
                {
                    "title": title,
                    "description": f"<{link}|*{title}*>  \n",
                    "url": f"{link}&referrer=discord",
                    "color": LEVEL_TO_COLOR["_incident_resolved"],
                }
            ],
            "components": [],
        }

    def test_metric_alert_with_selected_incident(self):
        new_status = IncidentStatus.CLOSED.value
        incident = self.create_incident(alert_rule=self.alert_rule, status=new_status)
        trigger = self.create_alert_rule_trigger(self.alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Resolved: {self.alert_rule.name}"
        link = (
            absolute_uri(
                reverse(
                    "sentry-metric-alert-details",
                    kwargs={
                        "organization_slug": self.alert_rule.organization.slug,
                        "alert_rule_id": self.alert_rule.id,
                    },
                )
            )
            + f"?alert={incident.identifier}"
        )

        assert DiscordMetricAlertMessageBuilder(self.alert_rule, incident).build() == {
            "content": "",
            "embeds": [
                {
                    "title": title,
                    "description": f"<{link}|*{title}*>  \n",
                    "url": f"{link}&referrer=discord",
                    "color": LEVEL_TO_COLOR["_incident_resolved"],
                }
            ],
            "components": [],
        }

    def test_metric_alert_with_active_incident(self):
        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.CRITICAL.value
        )
        trigger = self.create_alert_rule_trigger(self.alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Critical: {self.alert_rule.name}"
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": self.alert_rule.organization.slug,
                    "alert_rule_id": self.alert_rule.id,
                },
            )
        )

        assert DiscordMetricAlertMessageBuilder(self.alert_rule).build() == {
            "content": "",
            "embeds": [
                {
                    "color": LEVEL_TO_COLOR["fatal"],
                    "title": title,
                    "description": f"<{link}|*{title}*>  \n0 events in the last 10 minutes",
                    "url": f"{link}&referrer=discord",
                }
            ],
            "components": [],
        }

    def test_metric_value(self):
        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.CLOSED.value
        )

        # This test will use the action/method and not the incident to build status
        title = f"Critical: {self.alert_rule.name}"
        metric_value = 5000
        trigger = self.create_alert_rule_trigger(self.alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": self.alert_rule.organization.slug,
                    "alert_rule_id": self.alert_rule.id,
                },
            )
        )
        assert DiscordMetricAlertMessageBuilder(
            self.alert_rule, incident, IncidentStatus.CRITICAL, metric_value=metric_value
        ).build() == {
            "content": "",
            "embeds": [
                {
                    "title": title,
                    "color": LEVEL_TO_COLOR["fatal"],
                    "description": f"<{link}?alert={incident.identifier}|*{title}*>  \n"
                    f"{metric_value} events in the last 10 minutes",
                    "url": f"{link}?alert={incident.identifier}&referrer=discord",
                }
            ],
            "components": [],
        }

    def test_metric_alert_chart(self):
        title = f"Resolved: {self.alert_rule.name}"
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": self.alert_rule.organization.slug,
                    "alert_rule_id": self.alert_rule.id,
                },
            )
        )
        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.OPEN.value
        )
        new_status = IncidentStatus.CLOSED
        assert DiscordMetricAlertMessageBuilder(
            self.alert_rule, incident, new_status, chart_url="chart_url"
        ).build() == {
            "content": "",
            "embeds": [
                {
                    "title": title,
                    "description": f"<{link}?alert={incident.identifier}|*{title}*>  \n",
                    "url": f"{link}?alert={incident.identifier}&referrer=discord",
                    "color": 5097329,
                    "image": {"url": "chart_url"},
                }
            ],
            "components": [],
        }
