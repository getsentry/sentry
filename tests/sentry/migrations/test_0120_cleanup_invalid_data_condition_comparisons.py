from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class CleanupInvalidDataConditionComparisonsTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0119_add_index_for_all_project_detectors"
    migrate_to = "0120_cleanup_invalid_data_condition_comparisons"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        DataCondition = apps.get_model("workflow_engine", "DataCondition")
        DataConditionGroup = apps.get_model("workflow_engine", "DataConditionGroup")

        with unguarded_write(using="default"):
            organization = Organization.objects.create(
                slug="cleanup-data-condition-comparisons",
                name="Cleanup Data Condition Comparisons",
            )
            default_group = DataConditionGroup.objects.create(organization_id=organization.id)
            deescalation_group = DataConditionGroup.objects.create(organization_id=organization.id)
            ambiguous_group = DataConditionGroup.objects.create(organization_id=organization.id)

            DataCondition.objects.create(
                condition_group_id=deescalation_group.id,
                type="issue_priority_greater_or_equal",
                comparison=75,
                condition_result=True,
            )
            for comparison in (50, 75):
                DataCondition.objects.create(
                    condition_group_id=ambiguous_group.id,
                    type="issue_priority_greater_or_equal",
                    comparison=comparison,
                    condition_result=True,
                )

            values = {
                "seen-string": ("event_seen_count", "2", default_group.id),
                "seen-boolean": ("event_seen_count", True, default_group.id),
                "detector-string": ("event_created_by_detector", "42", default_group.id),
                "resolution-string": ("issue_resolution_change", "resolved", default_group.id),
                "priority-string": ("issue_priority_equals", "25", default_group.id),
                "deescalation-string": (
                    "issue_priority_deescalating",
                    "50",
                    default_group.id,
                ),
                "deescalation-boolean": (
                    "issue_priority_deescalating",
                    True,
                    deescalation_group.id,
                ),
                "invalid-detector": (
                    "event_created_by_detector",
                    "detector",
                    default_group.id,
                ),
                "ambiguous-deescalation": (
                    "issue_priority_deescalating",
                    True,
                    ambiguous_group.id,
                ),
                "existing-priority-name": ("issue_priority_equals", "high", default_group.id),
            }
            self.condition_ids = {}
            for name, (condition_type, comparison, group_id) in values.items():
                condition = DataCondition.objects.create(
                    condition_group_id=group_id,
                    type=condition_type,
                    comparison=comparison,
                    condition_result=True,
                )
                self.condition_ids[name] = condition.id

    def test(self):
        DataCondition = self.apps.get_model("workflow_engine", "DataCondition")
        comparisons = {
            name: DataCondition.objects.get(id=condition_id).comparison
            for name, condition_id in self.condition_ids.items()
        }

        assert comparisons == {
            "seen-string": 2,
            "seen-boolean": 1,
            "detector-string": 42,
            "resolution-string": 1,
            "priority-string": 25,
            "deescalation-string": 50,
            "deescalation-boolean": 75,
            "invalid-detector": "detector",
            "ambiguous-deescalation": True,
            "existing-priority-name": "high",
        }
