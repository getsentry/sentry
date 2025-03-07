from unittest.mock import patch

import orjson
import responses
from urllib3.response import HTTPResponse

from sentry.incidents.action_handlers import OpsgenieActionHandler
from sentry.incidents.logic import update_incident_status
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleTriggerAction,
)
from sentry.incidents.models.incident import IncidentStatus, IncidentStatusMethod
from sentry.integrations.metric_alerts import AlertContext
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.seer.anomaly_detection.types import StoreDataResponse
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.utils import json

from . import FireTest

METADATA = {
    "api_key": "1234-ABCD",
    "base_url": "https://api.opsgenie.com/",
    "domain_name": "test-app.app.opsgenie.com",
}


@freeze_time()
class OpsgenieActionHandlerTest(FireTest):
    @responses.activate
    def setUp(self):
        self.og_team = {"id": "123-id", "team": "cool-team", "integration_key": "1234-5678"}
        self.integration = self.create_provider_integration(
            provider="opsgenie", name="hello-world", external_id="hello-world", metadata=METADATA
        )
        with assume_test_silo_mode_of(Integration, OrganizationIntegration):
            self.integration.add_organization(self.organization, self.user)
            self.org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=self.integration.id
            )
            self.org_integration.config = {"team_table": [self.og_team]}
            self.org_integration.save()

        resp_data = {
            "result": "Integration [sentry] is valid",
            "took": 1,
            "requestId": "hello-world",
        }
        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/integrations/authenticate",
            json=resp_data,
        )

        self.action = self.create_alert_rule_trigger_action(
            target_identifier=self.og_team["id"],
            type=AlertRuleTriggerAction.Type.OPSGENIE,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.integration,
        )

    @responses.activate
    def test_build_incident_attachment(self):
        from sentry.integrations.opsgenie.utils import build_incident_attachment

        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule)
        update_incident_status(
            incident, IncidentStatus.CRITICAL, status_method=IncidentStatusMethod.RULE_TRIGGERED
        )
        resp_data = {
            "result": "Integration [sentry] is valid",
            "took": 1,
            "requestId": "hello-world",
        }
        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/integrations/authenticate",
            json=resp_data,
        )
        self.create_alert_rule_trigger_action(
            target_identifier=self.og_team["id"],
            type=AlertRuleTriggerAction.Type.OPSGENIE,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.integration,
        )
        metric_value = 1000
        data = build_incident_attachment(
            alert_context=AlertContext.from_alert_rule_incident(incident.alert_rule),
            open_period_identifier=incident.identifier,
            organization=incident.organization,
            snuba_query=incident.alert_rule.snuba_query,
            new_status=IncidentStatus(incident.status),
            metric_value=metric_value,
        )

        assert data["message"] == alert_rule.name
        assert data["alias"] == f"incident_{incident.organization_id}_{incident.identifier}"
        assert data["description"] == "1000 events in the last 10 minutes"
        assert data["priority"] == "P1"
        assert (
            data["details"]["URL"]
            == f"http://testserver/organizations/baz/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}&referrer=metric_alert_opsgenie&detection_type={alert_rule.detection_type}"
        )

    @responses.activate
    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_build_incident_attachment_dynamic_alert(self, mock_seer_request):
        from sentry.integrations.opsgenie.utils import build_incident_attachment

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
        update_incident_status(
            incident, IncidentStatus.CRITICAL, status_method=IncidentStatusMethod.RULE_TRIGGERED
        )
        resp_data = {
            "result": "Integration [sentry] is valid",
            "took": 1,
            "requestId": "hello-world",
        }
        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/integrations/authenticate",
            json=resp_data,
        )
        self.create_alert_rule_trigger_action(
            target_identifier=self.og_team["id"],
            type=AlertRuleTriggerAction.Type.OPSGENIE,
            target_type=AlertRuleTriggerAction.TargetType.SPECIFIC,
            integration=self.integration,
            alert_rule_trigger=trigger,
            triggered_for_incident=incident,
        )
        metric_value = 1000
        data = build_incident_attachment(
            alert_context=AlertContext.from_alert_rule_incident(incident.alert_rule),
            open_period_identifier=incident.identifier,
            organization=incident.organization,
            snuba_query=incident.alert_rule.snuba_query,
            new_status=IncidentStatus(incident.status),
            metric_value=metric_value,
        )

        assert data["message"] == alert_rule.name
        assert data["alias"] == f"incident_{incident.organization_id}_{incident.identifier}"
        assert (
            data["description"]
            == f"1000 events in the last 30 minutes\nThreshold: {alert_rule.detection_type.title()}"
        )
        assert data["priority"] == "P1"
        assert (
            data["details"]["URL"]
            == f"http://testserver/organizations/baz/alerts/rules/details/{alert_rule.id}/?alert={incident.identifier}&referrer=metric_alert_opsgenie&detection_type={alert_rule.detection_type}"
        )

    @responses.activate
    def run_test(self, incident, method):
        from sentry.integrations.opsgenie.utils import (
            attach_custom_priority,
            build_incident_attachment,
        )

        alias = f"incident_{incident.organization_id}_{incident.identifier}"

        if method == "resolve":
            responses.add(
                responses.POST,
                url=f"https://api.opsgenie.com/v2/alerts/{alias}/close?identifierType=alias",
                json={},
                status=202,
            )
            expected_payload = {}
            new_status = IncidentStatus.CLOSED
        else:
            new_status = IncidentStatus.CRITICAL
            update_incident_status(
                incident, new_status, status_method=IncidentStatusMethod.RULE_TRIGGERED
            )
            responses.add(
                responses.POST,
                url="https://api.opsgenie.com/v2/alerts",
                json={},
                status=202,
            )
            expected_payload = build_incident_attachment(
                alert_context=AlertContext.from_alert_rule_incident(incident.alert_rule),
                open_period_identifier=incident.identifier,
                organization=incident.organization,
                snuba_query=incident.alert_rule.snuba_query,
                new_status=new_status,
                metric_value=1000,
            )
            expected_payload = attach_custom_priority(expected_payload, self.action, new_status)

        handler = OpsgenieActionHandler(self.action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            getattr(handler, method)(metric_value, IncidentStatus(incident.status))
        data = responses.calls[0].request.body

        assert json.loads(data) == expected_payload

    @responses.activate
    def test_fire_metric_alert(self):
        self.run_fire_test()

    @responses.activate
    def test_fire_metric_alert_multiple_teams(self):
        team2 = {"id": "456-id", "team": "cooler-team", "integration_key": "1234-7890"}
        self.org_integration.config["team_table"].append(team2)
        with assume_test_silo_mode_of(OrganizationIntegration):
            self.org_integration.save()

        self.run_fire_test()

    @responses.activate
    def test_resolve_metric_alert(self):
        self.run_fire_test("resolve")

    @responses.activate
    def test_rule_snoozed(self):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule, status=IncidentStatus.CLOSED.value)
        self.snooze_rule(alert_rule=alert_rule)

        responses.add(
            responses.POST,
            url="https://api.opsgenie.com/v2/alerts",
            json={},
            status=202,
        )
        handler = OpsgenieActionHandler(self.action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus(incident.status))

        assert len(responses.calls) == 0

    @responses.activate
    @patch("sentry.integrations.opsgenie.utils.logger")
    def test_missing_integration(self, mock_logger):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule)

        with assume_test_silo_mode_of(Integration):
            self.integration.delete()

        handler = OpsgenieActionHandler(self.action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus(incident.status))

        assert len(responses.calls) == 0
        assert (
            mock_logger.info.call_args.args[0]
            == "Opsgenie integration removed, but the rule is still active."
        )

    @responses.activate
    @patch("sentry.integrations.opsgenie.utils.logger")
    def test_missing_team(self, mock_logger):
        alert_rule = self.create_alert_rule()
        incident = self.create_incident(alert_rule=alert_rule)

        self.org_integration.config = {"team_table": []}
        with assume_test_silo_mode_of(OrganizationIntegration):
            self.org_integration.save()

        handler = OpsgenieActionHandler(self.action, incident, self.project)
        metric_value = 1000
        with self.tasks():
            handler.fire(metric_value, IncidentStatus(incident.status))

        assert len(responses.calls) == 0
        assert (
            mock_logger.info.call_args.args[0]
            == "Opsgenie team removed, but the rule is still active."
        )

    @patch("sentry.analytics.record")
    def test_alert_sent_recorded(self, mock_record):
        self.run_fire_test()
        mock_record.assert_called_with(
            "alert.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            provider="opsgenie",
            alert_id=self.alert_rule.id,
            alert_type="metric_alert",
            external_id=str(self.action.target_identifier),
            notification_uuid="",
        )

    @responses.activate
    def test_custom_priority(self):
        # default critical incident priority is P1, custom set to P3
        self.action.update(sentry_app_config={"priority": "P3"})
        self.run_fire_test()

    @responses.activate
    def test_custom_priority_resolve(self):
        self.action.update(sentry_app_config={"priority": "P3"})
        self.run_fire_test("resolve")
