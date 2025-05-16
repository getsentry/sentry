from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import Condition, DataCondition, DataConditionGroup
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestBackfillMetricAlertResolutionActionFilters(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0060_rename_azure_devops_action_to_vsts"
    migrate_to = "0061_backfill_metric_alert_resolution_action_filters"

    def mock_aci_objects(self) -> tuple[DataConditionGroup, DataConditionGroup]:
        alert_rule = self.create_alert_rule(organization=self.organization)
        workflow = self.create_workflow(organization=self.organization)
        self.create_alert_rule_workflow(alert_rule_id=alert_rule.id, workflow=workflow)

        critical_dcg = self.create_data_condition_group(organization=self.organization)
        self.create_workflow_data_condition_group(workflow=workflow, condition_group=critical_dcg)
        self.create_data_condition(
            comparison=DetectorPriorityLevel.HIGH,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
            condition_group=critical_dcg,
        )

        warning_dcg = self.create_data_condition_group(organization=self.organization)
        self.create_workflow_data_condition_group(workflow=workflow, condition_group=warning_dcg)
        self.create_data_condition(
            comparison=DetectorPriorityLevel.MEDIUM,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
            condition_group=warning_dcg,
        )

        return critical_dcg, warning_dcg

    def create_resolve_action_filter(
        self, dcg: DataConditionGroup, comparison: DetectorPriorityLevel
    ) -> None:
        self.create_data_condition(
            comparison=comparison,
            condition_result=True,
            type=Condition.ISSUE_PRIORITY_DEESCALATING,
            condition_group=dcg,
        )

    def assert_resolve_action_filter_exists(
        self, dcg: DataConditionGroup, comparison: DetectorPriorityLevel
    ) -> None:
        queryset = DataCondition.objects.filter(
            comparison=comparison, type=Condition.ISSUE_PRIORITY_DEESCALATING, condition_group=dcg
        )
        assert queryset.exists()
        assert queryset.count() == 1

    def setup_initial_state(self):
        # vanilla
        self.critical_dcg_1, self.warning_dcg_1 = self.mock_aci_objects()

        # both dcgs have a resolution action filter
        self.critical_dcg_2, self.warning_dcg_2 = self.mock_aci_objects()
        self.create_resolve_action_filter(self.critical_dcg_2, DetectorPriorityLevel.HIGH)
        self.create_resolve_action_filter(self.warning_dcg_2, DetectorPriorityLevel.MEDIUM)

        # only one dcg has a resolution action filter
        self.critical_dcg_3, self.warning_dcg_3 = self.mock_aci_objects()
        self.create_resolve_action_filter(self.warning_dcg_3, DetectorPriorityLevel.MEDIUM)

    def test_simple(self):
        self.assert_resolve_action_filter_exists(self.critical_dcg_1, DetectorPriorityLevel.HIGH)
        self.assert_resolve_action_filter_exists(self.warning_dcg_1, DetectorPriorityLevel.MEDIUM)

    def test_both_migrated(self):
        self.assert_resolve_action_filter_exists(self.critical_dcg_2, DetectorPriorityLevel.HIGH)
        self.assert_resolve_action_filter_exists(self.warning_dcg_2, DetectorPriorityLevel.MEDIUM)

    def test_one_migrated(self):
        self.assert_resolve_action_filter_exists(self.critical_dcg_3, DetectorPriorityLevel.HIGH)
        self.assert_resolve_action_filter_exists(self.warning_dcg_3, DetectorPriorityLevel.MEDIUM)
