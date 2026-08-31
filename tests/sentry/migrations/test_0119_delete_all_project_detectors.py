from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class DeleteAllProjectDetectorsTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0118_repair_latest_adopted_release_environments"
    migrate_to = "0119_delete_all_project_detectors"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        Project = apps.get_model("sentry", "Project")
        Detector = apps.get_model("workflow_engine", "Detector")

        with unguarded_write(using="default"):
            org = Organization.objects.create(slug="delete-detectors", name="Delete Detectors")
            project = Project.objects.create(
                organization_id=org.id, slug="a-project", name="A Project"
            )

        # Deleted: project-less `issue_stream` detectors.
        self.all_projects_detector = Detector.objects.create(
            type="issue_stream",
            project=None,
            config={"organization_id": org.id},
            name="Issue Stream: All Projects",
            enabled=True,
        )

        # Kept: an `issue_stream` detector that has a project.
        self.project_detector = Detector.objects.create(
            type="issue_stream",
            project=project,
            config={},
            name="Issue Stream",
            enabled=True,
        )

        # Kept: a project-less detector of a different type.
        self.other_type_detector = Detector.objects.create(
            type="metric_issue",
            project=None,
            config={"organization_id": org.id},
            name="Other Type",
            enabled=True,
        )

    def test(self):
        Detector = self.apps.get_model("workflow_engine", "Detector")

        assert not Detector.objects.filter(project__isnull=True, type="issue_stream").exists()
        assert Detector.objects.filter(id=self.project_detector.id).exists()
        assert Detector.objects.filter(id=self.other_type_detector.id).exists()
