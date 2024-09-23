from unittest.mock import patch

import orjson
from urllib3 import HTTPResponse

from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleSeasonality,
    AlertRuleSensitivity,
    AlertRuleTrigger,
)
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin


class DeleteAlertRuleTest(TestCase, HybridCloudTestMixin):
    def test_simple(self):
        organization = self.create_organization()
        alert_rule = self.create_alert_rule(organization=organization)
        alert_rule_trigger = self.create_alert_rule_trigger(alert_rule=alert_rule)

        self.ScheduledDeletion.schedule(instance=alert_rule, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert Organization.objects.filter(id=organization.id).exists()
        assert not AlertRule.objects.filter(id=alert_rule.id).exists()
        assert not AlertRuleTrigger.objects.filter(id=alert_rule_trigger.id).exists()

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.delete_rule.seer_anomaly_detection_connection_pool.urlopen"
    )
    @patch(
        "sentry.seer.anomaly_detection.store_data.seer_anomaly_detection_connection_pool.urlopen"
    )
    def test_dynamic_alert_rule(self, mock_store_request, mock_delete_request):
        organization = self.create_organization()
        alert_rule = self.create_alert_rule(organization=organization)

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

        self.ScheduledDeletion.schedule(instance=alert_rule, days=0)

        with self.tasks():
            run_scheduled_deletions()

        assert Organization.objects.filter(id=organization.id).exists()
        assert not AlertRule.objects.filter(id=alert_rule.id).exists()

        assert mock_delete_request.call_count == 1
