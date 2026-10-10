from sentry.constants import ObjectStatus
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.monitors.models import Monitor
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.workflow_engine.models import Detector


def update_monitor_status(monitor: Monitor, status: int) -> None:
    monitor.update(status=status)
    sync_cron_detector_enabled(monitor)


def sync_cron_detector_enabled(monitor: Monitor) -> None:
    """
    The monitors UI reads `Detector.enabled`, so keep it in line with
    `Monitor.status` whenever the status changes.
    """
    with in_test_hide_transaction_boundary():
        detector = Detector.objects.filter(
            datasource__type=DATA_SOURCE_CRON_MONITOR,
            datasource__source_id=str(monitor.id),
            datasource__organization_id=monitor.organization_id,
        ).first()
    enabled = monitor.status == ObjectStatus.ACTIVE
    if detector and detector.enabled != enabled:
        detector.update(enabled=enabled)
