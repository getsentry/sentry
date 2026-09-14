from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class RepairLatestAdoptedReleaseEnvironmentsTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0117_backfill_all_project_detectors"
    migrate_to = "0118_repair_latest_adopted_release_environments"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        Environment = apps.get_model("sentry", "Environment")
        DataCondition = apps.get_model("workflow_engine", "DataCondition")
        DataConditionGroup = apps.get_model("workflow_engine", "DataConditionGroup")

        with unguarded_write(using="default"):
            organization = Organization.objects.create(
                slug="latest-adopted-release",
                name="Latest Adopted Release",
            )
            environment = Environment.objects.create(
                organization_id=organization.id,
                name="production",
            )
            Environment.objects.create(
                organization_id=organization.id,
                name="12345",
            )
            condition_group = DataConditionGroup.objects.create(organization_id=organization.id)
            self.broken_condition = DataCondition.objects.create(
                condition_group_id=condition_group.id,
                type="latest_adopted_release",
                comparison={
                    "release_age_type": "oldest",
                    "age_comparison": "newer",
                    "environment": str(environment.id),
                },
                condition_result=True,
            )
            self.valid_condition = DataCondition.objects.create(
                condition_group_id=condition_group.id,
                type="latest_adopted_release",
                comparison={
                    "release_age_type": "oldest",
                    "age_comparison": "newer",
                    "environment": environment.name,
                },
                condition_result=True,
            )
            self.numeric_name_condition = DataCondition.objects.create(
                condition_group_id=condition_group.id,
                type="latest_adopted_release",
                comparison={
                    "release_age_type": "oldest",
                    "age_comparison": "newer",
                    "environment": "12345",
                },
                condition_result=True,
            )
            self.unknown_id_condition = DataCondition.objects.create(
                condition_group_id=condition_group.id,
                type="latest_adopted_release",
                comparison={
                    "release_age_type": "oldest",
                    "age_comparison": "newer",
                    "environment": "987654321",
                },
                condition_result=True,
            )

    def test(self):
        DataCondition = self.apps.get_model("workflow_engine", "DataCondition")

        broken_condition = DataCondition.objects.get(id=self.broken_condition.id)
        assert broken_condition.comparison["environment"] == "production"

        valid_condition = DataCondition.objects.get(id=self.valid_condition.id)
        assert valid_condition.comparison["environment"] == "production"

        numeric_name_condition = DataCondition.objects.get(id=self.numeric_name_condition.id)
        assert numeric_name_condition.comparison["environment"] == "12345"

        unknown_id_condition = DataCondition.objects.get(id=self.unknown_id_condition.id)
        assert unknown_id_condition.comparison["environment"] == "987654321"
