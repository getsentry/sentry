import responses
from freezegun import freeze_time

from sentry.incidents.action_handlers import PagerDutyActionHandler
from sentry.incidents.logic import update_incident_status
from sentry.incidents.models import AlertRuleTriggerAction, IncidentStatus, IncidentStatusMethod
from sentry.models import Integration, PagerDutyService
from sentry.testutils import TestCase
from sentry.utils import json

from . import FireTest


@freeze_time()
class PagerDutyActionHandlerTest(FireTest, TestCase):
    def setUp(self):
        self.integration_key = "pfc73e8cb4s44d519f3d63d45b5q77g9"
        service = [
            {
                "type": "service",
                "integration_key": self.integration_key,
                "service_id": "123",
                "service_name": "hellboi",
            }
        ]
        self.integration = Integration.objects.create(
            provider="pagerduty",
            name="Example PagerDuty",
            external_id="example-pagerduty",
            metadata={"service": service},
        )
        self.integration.add_organization(self.organization, self.user)

        self.service = PagerDutyService.objects.create(
            service_name=service[0]["service_name"],
            integration_key=service[0]["integration_key"],
            organization_integration=self.integration.organizationintegrations.first(),
        )

    def test_build_incident_attachment(self):
        from sentry.integrations.pagerduty.utils import build_incident_attachment

        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule)
        update_incident_status(
            incident, IncidentStatus.CRITICAL, status_method=IncidentStatusMethod.RULE_TRIGGERED
        )
        self.create_alert_rule_trigger_action(
            target_identifier=self.service.id,
            type=AlertRuleTriggerAction.Type.PAGERDUTY,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.integration,
        )
        metric_value = 1000
        data = build_incident_attachment(
            incident, self.integration_key, IncidentStatus(incident.status), metric_value
        )

        assert data["routing_key"] == self.integration_key
        assert data["event_action"] == "trigger"
        assert data["dedup_key"] == f"incident_{incident.organization_id}_{incident.identifier}"
        assert data["payload"]["summary"] == alert_rule.name
        assert data["payload"]["severity"] == "critical"
        assert data["payload"]["source"] == str(incident.identifier)
        assert data["payload"]["custom_details"] == {
            "details": "1000 events in the last 10 minutes"
        }
        assert data["links"][0]["text"] == f"Critical: {alert_rule.name}"
        assert (
            data["links"][0]["href"]
            == f"http://testserver/organizations/baz/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}"
        )

    @responses.activate
    def run_test(self, incident, method):
        from sentry.integrations.pagerduty.utils import build_incident_attachment

        action = self.create_alert_rule_trigger_action(
            target_identifier=self.service.id,
            type=AlertRuleTriggerAction.Type.PAGERDUTY,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.integration,
        )

        responses.add(
            method=responses.POST,
            url="https://events.pagerduty.com/v2/enqueue/",
            json={},
            status=202,
            content_type="application/json",
        )
        handler = PagerDutyActionHandler(action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = responses.calls[0].request.body

        assert json.loads(data) == build_incident_attachment(
            incident, self.service.integration_key, IncidentStatus(incident.status), metric_value
        )

    def test_fire_metric_alert(self):
        self.run_fire_test()

    def test_fire_metric_alert_multiple_services(self):
        service = [
            {
                "type": "service",
                "integration_key": "afc73e8cb4s44d519f3d63d45b5q77g9",
                "service_id": "456",
                "service_name": "meowmeowfuntime",
            },
        ]
        PagerDutyService.objects.create(
            service_name=service[0]["service_name"],
            integration_key=service[0]["integration_key"],
            organization_integration=self.integration.organizationintegrations.first(),
        )
        self.run_fire_test()

    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")
