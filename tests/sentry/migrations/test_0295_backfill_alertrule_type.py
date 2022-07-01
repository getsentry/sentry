from sentry.incidents.models import AlertRule
from sentry.models import ReleaseProject
from sentry.snuba.models import QueryDatasets
from sentry.testutils.cases import TestMigrations


class BackfillProjectHasReleaseTest(TestMigrations):
    migrate_from = "0294_alertrule_type"
    migrate_to = "0295_backfill_alertrule_type"

    def setup_before_migration(self, apps):
        self.alerts = [
            self.create_alert_rule(query="", dataset=dataset) for dataset in QueryDatasets
        ]
        # Make sure type is null, since this will be autofilled later on
        AlertRule.objects.filter(id__in=[alert.id for alert in self.alerts]).update(type=None)
        self.project.flags.has_releases = False
        self.project.save(update_fields=["flags"])
        ReleaseProject.objects.get_or_create(project=self.project, release=self.release)
        self.no_release_project = self.create_project()

    def test(self):
        for alert, expected_type in zip(
            self.alerts,
            [
                AlertRule.Type.Error,
                AlertRule.Type.Performance,
                AlertRule.Type.CrashRate,
                AlertRule.Type.CrashRate,
            ],
        ):
            alert.refresh_from_db()
            assert alert.type == expected_type.value
