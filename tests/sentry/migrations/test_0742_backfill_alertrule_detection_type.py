from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.testutils.cases import APITestCase, TestMigrations


class TestBackfillDetectionType(TestMigrations, APITestCase):
    migrate_from = "0741_metric_alert_anomaly_detection"
    migrate_to = "0742_backfill_alertrule_detection_type"

    def setup_initial_state(self):
        self.metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project]
        )
        self.percent_metric_alert_rule = self.create_alert_rule(
            organization=self.project.organization, projects=[self.project], comparison_delta=60
        )

    def test(self):
        self.metric_alert_rule.refresh_from_db()
        assert self.metric_alert_rule.detection_type == AlertRuleDetectionType.STATIC
        self.percent_metric_alert_rule.refresh_from_db()
        assert self.percent_metric_alert_rule.detection_type == AlertRuleDetectionType.PERCENT
