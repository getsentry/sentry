import uuid

from sentry.incidents.logic import create_alert_rule
from sentry.incidents.models.alert_rule import AlertRuleDetectionType, AlertRuleThresholdType
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.testutils.cases import TestMigrations


class TestBackfillDetectionType(TestMigrations):
    migrate_from = "0741_metric_alert_anomaly_detection"
    migrate_to = "0742_backfill_alertrule_detection_type"

    def setup_initial_state(self):
        org = Organization.objects.create(name=f"org {uuid.uuid4()}")
        project = Project.objects.create(organization=org, name=f"project {uuid.uuid4()}")
        self.metric_alert_rule = create_alert_rule(
            organization=org,
            projects=[project],
            name=f"alert {uuid.uuid4()}",
            query="level:error",
            aggregate="count()",
            time_window=10,
            threshold_period=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
        )
        self.percent_metric_alert_rule = create_alert_rule(
            organization=org,
            projects=[project],
            name=f"alert {uuid.uuid4()}",
            query="level:error",
            aggregate="count()",
            time_window=10,
            threshold_period=1,
            threshold_type=AlertRuleThresholdType.ABOVE,
            comparison_delta=60,
        )

    def test(self):
        self.metric_alert_rule.refresh_from_db()
        assert self.metric_alert_rule.detection_type == AlertRuleDetectionType.STATIC
        self.percent_metric_alert_rule.refresh_from_db()
        assert self.percent_metric_alert_rule.detection_type == AlertRuleDetectionType.PERCENT
