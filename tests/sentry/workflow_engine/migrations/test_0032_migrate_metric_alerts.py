from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import (  # Action,; ActionAlertRuleTriggerAction,; AlertRuleWorkflow,; DataCondition,; DataConditionGroup,; DataConditionGroupAction,; DataSource,; DetectorState,; DetectorWorkflow,; Workflow,; WorkflowDataConditionGroup,
    AlertRuleDetector,
    Detector,
)


class MigrateMetricAlertTest(TestMigrations):
    migrate_from = "0031_make_detector_project_non_nullable"
    migrate_to = "0032_migrate_metric_alerts"
    app = "workflow_engine"

    def setUp(self):
        return super().setUp()

    def setup_initial_state(self):
        self.valid_rule = self.create_alert_rule(name="hojicha")
        self.valid_trigger = self.create_alert_rule_trigger(alert_rule=self.valid_rule)
        self.valid_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.valid_trigger
        )

    def test_simple(self):
        alert_rule_detector = AlertRuleDetector.objects.get(alert_rule=self.valid_rule)
        detector = Detector.objects.get(id=alert_rule_detector.detector.id)
        assert detector.name == self.valid_rule.name
