from __future__ import annotations

from unittest.mock import patch

import orjson
from django.urls import reverse
from urllib3.response import HTTPResponse

from sentry.incidents.logic import CRITICAL_TRIGGER_LABEL
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
)
from sentry.incidents.models.incident import IncidentStatus
from sentry.integrations.discord.message_builder import LEVEL_TO_COLOR
from sentry.integrations.discord.message_builder.metric_alerts import (
    DiscordMetricAlertMessageBuilder,
    get_started_at,
)
from sentry.seer.anomaly_detection.types import StoreDataResponse
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.utils.http import absolute_uri


class BuildMetricAlertAttachmentTest(TestCase):
    def setUp(self):
        super().setUp()
        self.alert_rule = self.create_alert_rule()

    def get_url(self, link, identifier, detection_type, uuid: str | None):
        if uuid is None:
            return f"{link}?alert={identifier}&referrer=metric_alert_discord&detection_type={detection_type}"
        return f"{link}?alert={identifier}&referrer=metric_alert_discord&detection_type={detection_type}&notification_uuid={uuid}"

    def test_metric_alert_with_selected_incident(self):
        new_status = IncidentStatus.CLOSED.value
        incident = self.create_incident(alert_rule=self.alert_rule, status=new_status)
        trigger = self.create_alert_rule_trigger(self.alert_rule, CRITICAL_TRIGGER_LABEL, 100)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Resolved: {self.alert_rule.name}"
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": self.organization.slug,
                    "alert_rule_id": self.alert_rule.id,
                },
            )
        )

        uuid = "uuid"
        assert DiscordMetricAlertMessageBuilder(
            alert_rule=self.alert_rule,
            incident=incident,
            new_status=IncidentStatus.CLOSED,
            metric_value=0,
        ).build(notification_uuid=uuid) == {
            "content": "",
            "embeds": [
                {
                    "title": title,
                    "description": f"0 events in the last 10 minutes{get_started_at(incident.date_started)}",
                    "url": self.get_url(
                        link, incident.identifier, self.alert_rule.detection_type, uuid
                    ),
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
                    "organization_slug": self.organization.slug,
                    "alert_rule_id": self.alert_rule.id,
                },
            )
        )
        uuid = "uuid"
        assert DiscordMetricAlertMessageBuilder(
            alert_rule=self.alert_rule,
            incident=incident,
            new_status=IncidentStatus.CRITICAL,
            metric_value=0,
        ).build(notification_uuid=uuid) == {
            "content": "",
            "embeds": [
                {
                    "color": LEVEL_TO_COLOR["fatal"],
                    "title": title,
                    "description": f"0 events in the last 10 minutes{get_started_at(incident.date_started)}",
                    "url": self.get_url(
                        link, incident.identifier, self.alert_rule.detection_type, uuid
                    ),
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
                    "organization_slug": self.organization.slug,
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
                    "url": self.get_url(
                        link, incident.identifier, self.alert_rule.detection_type, uuid
                    ),
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
                    "organization_slug": self.organization.slug,
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
            metric_value=0,
            chart_url="chart_url",
        ).build(notification_uuid=uuid) == {
            "content": "",
            "embeds": [
                {
                    "title": title,
                    "description": f"0 events in the last 10 minutes{get_started_at(incident.date_started)}",
                    "url": self.get_url(
                        link, incident.identifier, self.alert_rule.detection_type, uuid
                    ),
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
                    "organization_slug": self.organization.slug,
                    "alert_rule_id": self.alert_rule.id,
                },
            )
        )

        assert DiscordMetricAlertMessageBuilder(
            alert_rule=self.alert_rule,
            incident=incident,
            new_status=IncidentStatus.CRITICAL,
            metric_value=0,
        ).build() == {
            "content": "",
            "embeds": [
                {
                    "color": LEVEL_TO_COLOR["fatal"],
                    "title": title,
                    "description": f"0 events in the last 10 minutes{get_started_at(incident.date_started)}",
                    "url": self.get_url(
                        link, incident.identifier, self.alert_rule.detection_type, None
                    ),
                }
            ],
            "components": [],
        }

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_metric_alert_with_anomaly_detection(self, mock_seer_request):
        seer_return_value: StoreDataResponse = {"success": True}
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        alert_rule = self.create_alert_rule(
            detection_type=AlertRuleDetectionType.DYNAMIC,
            time_window=30,
            sensitivity=AlertRuleSensitivity.LOW,
            seasonality=AlertRuleSeasonality.AUTO,
        )
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CRITICAL.value)
        trigger = self.create_alert_rule_trigger(alert_rule=alert_rule, alert_threshold=0)
        self.create_alert_rule_trigger_action(
            alert_rule_trigger=trigger, triggered_for_incident=incident
        )
        title = f"Critical: {alert_rule.name}"
        link = absolute_uri(
            reverse(
                "sentry-metric-alert-details",
                kwargs={
                    "organization_slug": self.organization.slug,
                    "alert_rule_id": alert_rule.id,
                },
            )
        )
        uuid = "uuid"
        assert DiscordMetricAlertMessageBuilder(
            alert_rule=alert_rule,
            incident=incident,
            new_status=IncidentStatus.CRITICAL,
            metric_value=0,
        ).build(notification_uuid=uuid) == {
            "content": "",
            "embeds": [
                {
                    "color": LEVEL_TO_COLOR["fatal"],
                    "title": title,
                    "description": f"0 events in the last 30 minutes\nThreshold: {alert_rule.detection_type.title()}{get_started_at(incident.date_started)}",
                    "url": self.get_url(link, incident.identifier, alert_rule.detection_type, uuid),
                }
            ],
            "components": [],
        }
