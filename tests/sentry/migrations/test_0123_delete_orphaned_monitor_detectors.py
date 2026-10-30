from sentry.constants import ObjectStatus
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class DeleteOrphanedMonitorDetectorsTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0122_sync_cron_detector_enabled"
    migrate_to = "0123_delete_orphaned_monitor_detectors"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        Project = apps.get_model("sentry", "Project")
        DataSource = apps.get_model("workflow_engine", "DataSource")
        Detector = apps.get_model("workflow_engine", "Detector")
        DataSourceDetector = apps.get_model("workflow_engine", "DataSourceDetector")

        with unguarded_write(using="default"):
            org = Organization.objects.create(slug="orphaned-monitors", name="Orphaned Monitors")
        project = Project.objects.create(organization_id=org.id, slug="monitors", name="Monitors")

        def create(
            name: str,
            detector_type: str,
            source_type: str | None,
            status: int = ObjectStatus.ACTIVE,
        ) -> int:
            detector = Detector.objects.create(
                project_id=project.id,
                name=name,
                type=detector_type,
                status=status,
                config={},
            )
            if source_type is not None:
                data_source = DataSource.objects.create(
                    organization_id=org.id, source_id=str(detector.id), type=source_type
                )
                DataSourceDetector.objects.create(data_source=data_source, detector=detector)
            return detector.id

        self.orphaned_uptime_id = create("orphaned-uptime", "uptime_domain_failure", None)
        self.orphaned_cron_id = create("orphaned-cron", "monitor_check_in_failure", None)
        self.linked_uptime_id = create(
            "linked-uptime", "uptime_domain_failure", "uptime_subscription"
        )
        self.linked_cron_id = create("linked-cron", "monitor_check_in_failure", "cron_monitor")
        self.unlinked_error_id = create("error", "error", None)
        self.already_pending_id = create(
            "already-pending",
            "uptime_domain_failure",
            None,
            status=ObjectStatus.PENDING_DELETION,
        )

    def test(self) -> None:
        Detector = self.apps.get_model("workflow_engine", "Detector")
        CellScheduledDeletion = self.apps.get_model("sentry", "CellScheduledDeletion")

        scheduled_ids = set(
            CellScheduledDeletion.objects.filter(
                app_label="workflow_engine", model_name="Detector"
            ).values_list("object_id", flat=True)
        )
        statuses = dict(Detector.objects.values_list("id", "status"))

        for detector_id in (self.orphaned_uptime_id, self.orphaned_cron_id):
            with self.subTest(detector_id=detector_id):
                assert statuses[detector_id] == ObjectStatus.PENDING_DELETION
                assert detector_id in scheduled_ids

        for detector_id in (
            self.linked_uptime_id,
            self.linked_cron_id,
            self.unlinked_error_id,
        ):
            with self.subTest(detector_id=detector_id):
                assert statuses[detector_id] == ObjectStatus.ACTIVE
                assert detector_id not in scheduled_ids

        assert self.already_pending_id not in scheduled_ids
