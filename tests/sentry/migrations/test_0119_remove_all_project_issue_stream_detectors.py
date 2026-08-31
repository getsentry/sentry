from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class RemoveAllProjectIssueStreamDetectorsTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0118_repair_latest_adopted_release_environments"
    migrate_to = "0119_remove_all_project_issue_stream_detectors"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        Project = apps.get_model("sentry", "Project")
        Detector = apps.get_model("workflow_engine", "Detector")

        with unguarded_write(using="default"):
            self.organization = Organization.objects.create(
                slug="all-projects-cleanup",
                name="All Projects Cleanup",
            )
            self.project = Project.objects.create(
                organization_id=self.organization.id,
                slug="project",
                name="Project",
            )

        self.all_projects_detector = Detector.objects.create(
            type="issue_stream",
            project=None,
            config={"organization_id": self.organization.id},
            name="Issue Stream: All Projects",
            enabled=True,
        )
        self.project_issue_stream = Detector.objects.create(
            type="issue_stream",
            project_id=self.project.id,
            config={},
            name="Issue Stream",
            enabled=True,
        )
        self.other_all_projects = Detector.objects.create(
            type="error",
            project=None,
            config={"organization_id": self.organization.id},
            name="Other All Projects",
            enabled=True,
        )

    def test(self):
        Detector = self.apps.get_model("workflow_engine", "Detector")

        assert not Detector.objects.filter(id=self.all_projects_detector.id).exists()
        assert Detector.objects.filter(id=self.project_issue_stream.id).exists()
        assert Detector.objects.filter(id=self.other_all_projects.id).exists()
