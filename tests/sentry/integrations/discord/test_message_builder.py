from __future__ import annotations

from django.urls import reverse

from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models import IncidentStatus
from sentry.integrations.discord.message_builder import LEVEL_TO_COLOR
from sentry.integrations.discord.message_builder.metric_alerts import (
    DiscordMetricAlertMessageBuilder,
    get_started_at,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils.http import absolute_uri


@region_silo_test
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

        uuid = "uuid"
        assert DiscordMetricAlertMessageBuilder(alert_rule=self.alert_rule,).build(
            notification_uuid=uuid
        ) == {
            "content": "",
            "embeds": [
                {
                    "title": title,
                    "description": "",
                    "url": f"{link}&referrer=discord&notification_uuid={uuid}",
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

        uuid = "uuid"
        assert DiscordMetricAlertMessageBuilder(
            alert_rule=self.alert_rule,
            incident=incident,
        ).build(notification_uuid=uuid) == {
            "content": "",
            "embeds": [
                {
                    "title": title,
                    "description": get_started_at(incident.date_started),
                    "url": f"{link}&referrer=discord&notification_uuid={uuid}",
                    "color": LEVEL_TO_COLOR["_incident_resolved"],
                }
            ],
            "components": [],
        }

    def test_metric_alert_with_active_incident(self):
        new_status = IncidentStatus.CRITICAL.value
        incident = self.create_incident(alert_rule=self.alert_rule, status=new_status)
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
        uuid = "uuid"
        assert DiscordMetricAlertMessageBuilder(alert_rule=self.alert_rule,).build(
            notification_uuid=uuid
        ) == {
            "content": "",
            "embeds": [
                {
                    "color": LEVEL_TO_COLOR["fatal"],
                    "title": title,
                    "description": "0 events in the last 10 minutes",
                    "url": f"{link}&referrer=discord&notification_uuid={uuid}",
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
        uuid = "uuid"
        assert DiscordMetricAlertMessageBuilder(
            alert_rule=self.alert_rule,
            incident=incident,
            new_status=IncidentStatus.CRITICAL,
            metric_value=metric_value,
        ).build(notification_uuid=uuid) == {
            "content": "",
            "embeds": [
                {
                    "title": title,
                    "color": LEVEL_TO_COLOR["fatal"],
                    "description": f"{metric_value} events in the last 10 minutes{get_started_at(incident.date_started)}",
                    "url": f"{link}?alert={incident.identifier}&referrer=discord&notification_uuid={uuid}",
                }
            ],
            "components": [],
        }

    def test_metric_alert_chart(self):
        incident = self.create_incident(
            alert_rule=self.alert_rule, status=IncidentStatus.OPEN.value
        )
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

        new_status = IncidentStatus.CLOSED
        uuid = "uuid"
        assert DiscordMetricAlertMessageBuilder(
            alert_rule=self.alert_rule,
            incident=incident,
            new_status=new_status,
            chart_url="chart_url",
        ).build(notification_uuid=uuid) == {
            "content": "",
            "embeds": [
                {
                    "title": title,
                    "description": get_started_at(incident.date_started),
                    "url": f"{link}?alert={incident.identifier}&referrer=discord&notification_uuid={uuid}",
                    "color": LEVEL_TO_COLOR["_incident_resolved"],
                    "image": {"url": "chart_url"},
                }
            ],
            "components": [],
        }

    def test_metric_alert_no_uuid(self):
        new_status = IncidentStatus.CRITICAL.value
        incident = self.create_incident(alert_rule=self.alert_rule, status=new_status)
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

        assert DiscordMetricAlertMessageBuilder(alert_rule=self.alert_rule,).build() == {
            "content": "",
            "embeds": [
                {
                    "color": LEVEL_TO_COLOR["fatal"],
                    "title": title,
                    "description": "0 events in the last 10 minutes",
                    "url": f"{link}&referrer=discord",
                }
            ],
            "components": [],
        }
