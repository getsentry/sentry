import time

import responses
from freezegun import freeze_time

from sentry.incidents.action_handlers import MsTeamsActionHandler
from sentry.incidents.models import AlertRuleTriggerAction, IncidentStatus
from sentry.models import Integration
from sentry.testutils import TestCase
from sentry.utils import json

from . import FireTest


@freeze_time()
class MsTeamsActionHandlerTest(FireTest, TestCase):
    @responses.activate
    def run_test(self, incident, method):
        from sentry.integrations.msteams.card_builder import build_incident_attachment

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

        action = self.create_alert_rule_trigger_action(
            target_identifier=channel_name,
            type=AlertRuleTriggerAction.Type.MSTEAMS,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=integration,
        )

        responses.add(
            method=responses.POST,
            url="https://smba.trafficmanager.net/amer/v3/conversations/d_s/activities",
            status=200,
            json={},
        )

        handler = MsTeamsActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = json.loads(responses.calls[1].request.body)

        assert data["attachments"][0]["content"] == build_incident_attachment(
            incident, IncidentStatus(incident.status), metric_value
        )

    def test_fire_metric_alert(self):
        self.run_fire_test()
