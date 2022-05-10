from sentry.models import ReleaseProject
from sentry.testutils.cases import TestMigrations


class BackfillProjectHasReleaseTest(TestMigrations):
    migrate_from = "0289_dashboardwidgetquery_convert_orderby_to_field"
    migrate_to = "0290_fix_project_has_releases"

    def setup_before_migration(self, apps):
        self.project.flags.has_releases = False
        self.project.save(update_fields=["flags"])
        ReleaseProject.objects.get_or_create(project=self.project, release=self.release)
        self.no_release_project = self.create_project()

    def test(self):
        for project, should_have_releases in [
            (self.project, True),
            (self.no_release_project, False),
        ]:
            project.refresh_from_db()
            assert project.flags.has_releases == should_have_releases
