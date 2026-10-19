from uuid import uuid4

from django.db.migrations.loader import MigrationLoader

from sentry.constants import ObjectStatus
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class SyncCronDetectorEnabledTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0121_add_activation_id_to_detector_state"
    migrate_to = "0122_sync_cron_detector_enabled"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        Project = apps.get_model("sentry", "Project")
        # monitors isn't in the migrate_from state.
        Monitor = (
            MigrationLoader(None)
            .project_state(("monitors", "0001_squashed_0013_delete_monitor_is_muted_field"))
            .apps.get_model("monitors", "Monitor")
        )
        DataSource = apps.get_model("workflow_engine", "DataSource")
        Detector = apps.get_model("workflow_engine", "Detector")
        DataSourceDetector = apps.get_model("workflow_engine", "DataSourceDetector")

        with unguarded_write(using="default"):
            org = Organization.objects.create(slug="cron-sync", name="Cron Sync")
        project = Project.objects.create(organization_id=org.id, slug="cron-sync", name="Cron")

        def create(slug: str, status: int, enabled: bool) -> int:
            monitor = Monitor.objects.create(
                organization_id=org.id,
                project_id=project.id,
                guid=uuid4(),
                slug=slug,
                name=slug,
                status=status,
            )
            data_source = DataSource.objects.create(
                organization_id=org.id, source_id=str(monitor.id), type="cron_monitor"
            )
            detector = Detector.objects.create(
                project_id=project.id,
                name=slug,
                type="monitor_check_in_failure",
                enabled=enabled,
                config={},
            )
            DataSourceDetector.objects.create(data_source=data_source, detector=detector)
            return detector.id

        self.disabled_shown_enabled = create("disabled-enabled", ObjectStatus.DISABLED, True)
        self.active_shown_disabled = create("active-disabled", ObjectStatus.ACTIVE, False)
        self.active_enabled = create("active-enabled", ObjectStatus.ACTIVE, True)
        self.pending_deletion = create("pending-deletion", ObjectStatus.PENDING_DELETION, True)

        # Not a cron source, even though source_id matches a disabled monitor
        disabled_monitor_id = DataSource.objects.get(
            detectors__id=self.disabled_shown_enabled
        ).source_id
        other_source = DataSource.objects.create(
            organization_id=org.id, source_id=disabled_monitor_id, type="uptime_subscription"
        )
        other_detector = Detector.objects.create(
            project_id=project.id,
            name="uptime",
            type="uptime_domain_failure",
            enabled=True,
            config={},
        )
        DataSourceDetector.objects.create(data_source=other_source, detector=other_detector)
        self.other_type = other_detector.id

    def test(self) -> None:
        Detector = self.apps.get_model("workflow_engine", "Detector")
        assert not Detector.objects.get(id=self.disabled_shown_enabled).enabled
        assert Detector.objects.get(id=self.active_shown_disabled).enabled
        assert Detector.objects.get(id=self.active_enabled).enabled
        assert Detector.objects.get(id=self.pending_deletion).enabled
        assert Detector.objects.get(id=self.other_type).enabled
