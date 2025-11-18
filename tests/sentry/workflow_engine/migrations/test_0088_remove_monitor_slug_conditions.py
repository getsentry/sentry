import pytest

from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import DataCondition, DataConditionGroup


@pytest.mark.skip
class RemoveMonitorSlugConditionsTest(TestMigrations):
    migrate_from = "0087_relink_crons_to_compatible_issue_workflows"
    migrate_to = "0088_remove_monitor_slug_conditions"
    app = "workflow_engine"

    def setup_initial_state(self) -> None:
        self.org = self.create_organization(name="test-org")
        self.project = self.create_project(organization=self.org)
        self.dcg = DataConditionGroup.objects.create(organization_id=self.org.id)

        # Conditions that should be deleted
        self.monitor_slug_condition1 = DataCondition.objects.create(
            type="tagged_event",
            comparison={"key": "monitor.slug", "match": "eq", "value": "my-monitor-1"},
            condition_result=True,
            condition_group=self.dcg,
        )

        self.monitor_slug_condition2 = DataCondition.objects.create(
            type="tagged_event",
            comparison={"key": "monitor.slug", "match": "eq", "value": "my-monitor-2"},
            condition_result=True,
            condition_group=self.dcg,
        )

        # Conditions that should not be deleted
        self.level_condition = DataCondition.objects.create(
            type="tagged_event",
            comparison={"key": "level", "match": "eq", "value": "error"},
            condition_result=True,
            condition_group=self.dcg,
        )

        self.environment_condition = DataCondition.objects.create(
            type="tagged_event",
            comparison={"key": "environment", "match": "eq", "value": "production"},
            condition_result=True,
            condition_group=self.dcg,
        )

        self.custom_tag_condition = DataCondition.objects.create(
            type="tagged_event",
            comparison={"key": "custom.tag", "match": "eq", "value": "some-value"},
            condition_result=True,
            condition_group=self.dcg,
        )

        self.first_seen_condition = DataCondition.objects.create(
            type="first_seen_event",
            comparison=True,
            condition_result=True,
            condition_group=self.dcg,
        )

        self.age_comparison_condition = DataCondition.objects.create(
            type="age_comparison",
            comparison={"comparison_type": "older", "value": 30, "time": "minute"},
            condition_result=True,
            condition_group=self.dcg,
        )

        self.edge_case_condition = DataCondition.objects.create(
            type="tagged_event",
            comparison={"key": "other_field", "match": "eq", "value": "monitor.slug"},
            condition_result=True,
            condition_group=self.dcg,
        )

        self.nested_condition = DataCondition.objects.create(
            type="tagged_event",
            comparison={"key": "nested.monitor.slug", "match": "eq", "value": "test"},
            condition_result=True,
            condition_group=self.dcg,
        )

    def test_migration(self) -> None:
        # Verify that monitor.slug conditions are deleted
        assert not DataCondition.objects.filter(id=self.monitor_slug_condition1.id).exists()
        assert not DataCondition.objects.filter(id=self.monitor_slug_condition2.id).exists()

        # Verify that other tagged_event conditions are not deleted
        assert DataCondition.objects.filter(id=self.level_condition.id).exists()
        assert DataCondition.objects.filter(id=self.environment_condition.id).exists()
        assert DataCondition.objects.filter(id=self.custom_tag_condition.id).exists()
        assert DataCondition.objects.filter(id=self.first_seen_condition.id).exists()
        assert DataCondition.objects.filter(id=self.age_comparison_condition.id).exists()
        assert DataCondition.objects.filter(id=self.edge_case_condition.id).exists()
        assert DataCondition.objects.filter(id=self.nested_condition.id).exists()
