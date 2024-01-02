import time
from unittest.mock import patch

import responses

from sentry.incidents.action_handlers import MsTeamsActionHandler
from sentry.incidents.models import AlertRuleTriggerAction, IncidentStatus
from sentry.models.integrations.integration import Integration
from sentry.silo import SiloMode
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.utils import json

from . import FireTest


@region_silo_test
@freeze_time()
class MsTeamsActionHandlerTest(FireTest):
    @responses.activate
    def setUp(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = Integration.objects.create(
                provider="msteams",
                name="Galactic Empire",
                external_id="D4r7h_Pl4gu315_th3_w153",
                metadata={
                    "service_url": "https://smba.trafficmanager.net/amer",
                    "access_token": "d4rk51d3",
                    "expires_at": int(time.time()) + 86400,
                },
            )
            integration.add_organization(self.organization, self.user)

        channel_id = "d_s"
        channel_name = "Death Star"
        channels = [{"id": channel_id, "name": channel_name}]

        responses.add(
            method=responses.GET,
            url="https://smba.trafficmanager.net/amer/v3/teams/D4r7h_Pl4gu315_th3_w153/conversations",
            json={"conversations": channels},
        )

        self.action = self.create_alert_rule_trigger_action(
            target_identifier=channel_name,
            type=AlertRuleTriggerAction.Type.MSTEAMS,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=integration,
        )

    @responses.activate
    def run_test(self, incident, method):
        from sentry.integrations.msteams.card_builder.incident_attachment import (
            build_incident_attachment,
        )

        responses.add(
            method=responses.POST,
            url="https://smba.trafficmanager.net/amer/v3/conversations/d_s/activities",
            status=200,
            json={},
        )

        handler = MsTeamsActionHandler(self.action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = json.loads(responses.calls[0].request.body)

        assert data["attachments"][0]["content"] == build_incident_attachment(
            incident, IncidentStatus(incident.status), metric_value
        )

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")

    @patch("sentry.analytics.record")
    def test_alert_sent_recorded(self, mock_record):
        self.run_fire_test()
        mock_record.assert_called_with(
            "alert.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            provider="msteams",
            alert_id=self.alert_rule.id,
            alert_type="metric_alert",
            external_id=str(self.action.target_identifier),
            notification_uuid="",
        )

    @responses.activate
    def test_rule_snoozed(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        self.snooze_rule(alert_rule=alert_rule)
        responses.add(
            method=responses.POST,
            url="https://smba.trafficmanager.net/amer/v3/conversations/d_s/activities",
            status=200,
            json={},
        )

        handler = MsTeamsActionHandler(self.action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus(incident.status))

        assert len(responses.calls) == 0
