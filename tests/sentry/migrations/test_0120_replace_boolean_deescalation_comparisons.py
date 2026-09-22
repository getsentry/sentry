import pytest

from sentry.testutils.cases import TestMigrations


@pytest.mark.skip(reason="Migration already applied; test is slow and only useful before merge")
class ReplaceBooleanDeescalationComparisonsTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0119_add_index_for_all_project_detectors"
    migrate_to = "0120_replace_boolean_deescalation_comparisons"

    def setup_before_migration(self, apps):
        DataCondition = apps.get_model("workflow_engine", "DataCondition")
        DataConditionGroup = apps.get_model("workflow_engine", "DataConditionGroup")

        condition_group = DataConditionGroup.objects.create(organization_id=self.organization.id)
        self.boolean_condition = DataCondition.objects.create(
            condition_group_id=condition_group.id,
            type="issue_priority_deescalating",
            comparison=True,
            condition_result=True,
        )
        self.priority_condition = DataCondition.objects.create(
            condition_group_id=condition_group.id,
            type="issue_priority_deescalating",
            comparison=50,
            condition_result=True,
        )
        self.other_boolean_condition = DataCondition.objects.create(
            condition_group_id=condition_group.id,
            type="event_seen_count",
            comparison=True,
            condition_result=True,
        )

    def test(self):
        DataCondition = self.apps.get_model("workflow_engine", "DataCondition")

        boolean_condition = DataCondition.objects.get(id=self.boolean_condition.id)
        assert boolean_condition.comparison == 75

        priority_condition = DataCondition.objects.get(id=self.priority_condition.id)
        assert priority_condition.comparison == 50

        other_boolean_condition = DataCondition.objects.get(id=self.other_boolean_condition.id)
        assert other_boolean_condition.comparison is True
