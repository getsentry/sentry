from sentry.testutils.cases import TestMigrations


class BackfillProjectHasReleaseTest(TestMigrations):
    migrate_from = "0289_dashboardwidgetquery_convert_orderby_to_field"
    migrate_to = "0290_fix_project_has_releases"

    def setup_before_migration(self, apps):
        Project = apps.get_model("sentry", "Project")
        Release = apps.get_model("sentry", "Release")
        ReleaseProject = apps.get_model("sentry", "ReleaseProject")

        self.project = Project.objects.create(organization_id=self.organization.id, name="p1")
        self.project.flags.has_releases = False
        self.project.save(update_fields=["flags"])
        ReleaseProject.objects.create(
            project_id=self.project.id,
            release_id=Release.objects.create(
                organization_id=self.organization.id, version="test"
            ).id,
        )
        self.no_release_project = Project.objects.create(
            name="p2", organization_id=self.organization.id
        )

    def test(self):
        for project, should_have_releases in [
            (self.project, True),
            (self.no_release_project, False),
        ]:
            project.refresh_from_db()
            assert project.flags.has_releases == should_have_releases
