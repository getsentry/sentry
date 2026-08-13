from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class BackfillAllProjectDetectorsTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0116_detector_nullable_project"
    migrate_to = "0117_backfill_all_project_detectors"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        Detector = apps.get_model("workflow_engine", "Detector")

        with unguarded_write(using="default"):
            self.org_with_detector = Organization.objects.create(
                slug="with-detector", name="With Detector"
            )
        Detector.objects.create(
            type="issue_stream",
            project=None,
            config={"organization_id": self.org_with_detector.id},
            name="Issue Stream: All Projects",
            enabled=True,
        )

        with unguarded_write(using="default"):
            self.org_without_detector = Organization.objects.create(
                slug="without-detector", name="Without Detector"
            )

    def test(self):
        Detector = self.apps.get_model("workflow_engine", "Detector")

        existing = Detector.objects.filter(project__isnull=True, type="issue_stream").count()
        assert existing == 2

        new_detector = Detector.objects.get(
            project__isnull=True,
            config__organization_id=self.org_without_detector.id,
        )
        assert new_detector.enabled
        assert new_detector.name == "Issue Stream: All Projects"
        assert new_detector.type == "issue_stream"
