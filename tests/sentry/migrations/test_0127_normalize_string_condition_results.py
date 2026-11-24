from django.db.migrations.state import StateApps

from sentry.testutils.cases import TestMigrations


class NormalizeStringConditionResultsTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0126_workflowfirehistory_nullable_group"
    migrate_to = "0127_normalize_string_condition_results"

    def setup_before_migration(self, apps: StateApps) -> None:
        DataCondition = apps.get_model("workflow_engine", "DataCondition")
        DataConditionGroup = apps.get_model("workflow_engine", "DataConditionGroup")

        condition_group = DataConditionGroup.objects.create(organization_id=self.organization.id)

        def create(type: str, condition_result: object) -> int:
            return DataCondition.objects.create(
                condition_group_id=condition_group.id,
                type=type,
                comparison=True,
                condition_result=condition_result,
            ).id

        self.expected = {
            create("first_seen_event", "true"): True,
            create("level", "false"): False,
            create("every_event", True): True,
            create("tagged_event", "yes"): "yes",
            create("gt", "true"): "true",
            create("anomaly_detection", "false"): "false",
        }

    def test(self) -> None:
        DataCondition = self.apps.get_model("workflow_engine", "DataCondition")

        for condition_id, expected in self.expected.items():
            with self.subTest(condition_id=condition_id):
                condition = DataCondition.objects.get(id=condition_id)
                assert condition.condition_result == expected
                assert type(condition.condition_result) is type(expected)
