from unittest.mock import patch

import orjson
from django.utils import timezone
from urllib3 import HTTPResponse

from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleTrigger,
)
from sentry.incidents.models.incident import Incident
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin


class DeleteAlertRuleTest(TestCase, HybridCloudTestMixin):
    def test_simple(self):
        organization = self.create_organization()
        alert_rule = self.create_alert_rule(organization=organization)
        alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)
        incident = self.create_incident(
            organization,
            title="Incident #1",
            date_started=timezone.now(),
            date_detected=timezone.now(),
            projects=[self.project],
            alert_rule=alert_rule,
        )

        self.ScheduledDeletion.schedule(instance=alert_rule, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert Organization.objects.filter(id=organization.id).exists()
        assert not AlertRule.objects.filter(id=alert_rule.id).exists()
        assert not AlertRuleTrigger.objects.filter(id=alert_rule_trigger.id).exists()
        assert not Incident.objects.filter(id=incident.id).exists()

    @with_feature("organizations:anomaly-detection-alerts")
    @with_feature("organizations:anomaly-detection-rollout")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_dynamic_alert_rule(self, mock_store_request, mock_delete_request):
        organization = self.create_organization()

        seer_return_value = {"success": True}
        mock_store_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        mock_delete_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)

        alert_rule = self.create_alert_rule(
            sensitivity=AlertRuleSensitivity.HIGH,
            seasonality=AlertRuleSeasonality.AUTO,
            time_window=60,
            detection_type=AlertRuleDetectionType.DYNAMIC,
            organization=organization,
        )
        alert_rule_trigger = self.create_alert_rule_trigger(
            alert_rule=alert_rule, alert_threshold=0
        )
        incident = self.create_incident(
            organization,
            title="Incident #1",
            date_started=timezone.now(),
            date_detected=timezone.now(),
            projects=[self.project],
            alert_rule=alert_rule,
        )

        self.ScheduledDeletion.schedule(instance=alert_rule, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert Organization.objects.filter(id=organization.id).exists()
        assert not AlertRule.objects.filter(id=alert_rule.id).exists()
        assert not AlertRuleTrigger.objects.filter(id=alert_rule_trigger.id).exists()
        assert not Incident.objects.filter(id=incident.id).exists()

        assert mock_delete_request.call_count == 1

    @patch("sentry.workflow_engine.migration_helpers.alert_rule.dual_delete_migrated_alert_rule")
    def test_dual_delete(self, mock_dual_delete_call):
        """
        Test the that the pre delete signal deleting the ACI objects for a dual written alert rule is called.
        """
        organization = self.create_organization()
        alert_rule = self.create_alert_rule(resolve_threshold=10, organization=organization)

        self.ScheduledDeletion.schedule(instance=alert_rule, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert mock_dual_delete_call.call_count == 1

    @patch("sentry.incidents.models.alert_rule.logger")
    @patch("sentry.workflow_engine.migration_helpers.alert_rule.dual_delete_migrated_alert_rule")
    def test_dual_delete_error(self, mock_dual_delete_call, mock_logger):
        """
        Test that if an error happens in the dual delete helper, it is caught and logged.
        """
        mock_dual_delete_call.side_effect = Exception("bad stuff happened")
        organization = self.create_organization()
        alert_rule = self.create_alert_rule(resolve_threshold=10, organization=organization)

        self.ScheduledDeletion.schedule(instance=alert_rule, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert mock_dual_delete_call.call_count == 1
        mock_logger.exception.assert_called_with(
            "Error when dual deleting alert rule",
            extra={"rule_id": alert_rule.id, "error": "bad stuff happened"},
        )
