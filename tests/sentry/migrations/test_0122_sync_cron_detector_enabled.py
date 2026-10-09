from sentry.constants import ObjectStatus
from sentry.monitors.utils import ensure_cron_detector
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import Detector


class SyncCronDetectorEnabledTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0121_add_activation_id_to_detector_state"
    migrate_to = "0122_sync_cron_detector_enabled"

    def _create(self, slug: str, status: int, enabled: bool) -> Detector:
        monitor = self.create_monitor(slug=slug, status=status)
        detector = ensure_cron_detector(monitor)
        assert detector is not None
        Detector.objects.filter(id=detector.id).update(enabled=enabled)
        return detector

    def setup_before_migration(self, apps):
        self.disabled_shown_enabled = self._create("disabled-enabled", ObjectStatus.DISABLED, True)
        self.active_shown_disabled = self._create("active-disabled", ObjectStatus.ACTIVE, False)
        self.active_enabled = self._create("active-enabled", ObjectStatus.ACTIVE, True)
        self.pending_deletion = self._create(
            "pending-deletion", ObjectStatus.PENDING_DELETION, True
        )

    def test(self) -> None:
        assert not Detector.objects.get(id=self.disabled_shown_enabled.id).enabled
        assert Detector.objects.get(id=self.active_shown_disabled.id).enabled
        assert Detector.objects.get(id=self.active_enabled.id).enabled
        assert Detector.objects.get(id=self.pending_deletion.id).enabled
