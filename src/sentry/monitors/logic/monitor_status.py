from sentry.constants import ObjectStatus
from sentry.monitors.models import Monitor, get_detector_for_monitor


def update_monitor_status(monitor: Monitor, status: int) -> None:
    monitor.update(status=status)
    sync_cron_detector_enabled(monitor)


def sync_cron_detector_enabled(monitor: Monitor) -> None:
    """
    The monitors UI reads `Detector.enabled`, so keep it in line with
    `Monitor.status` whenever the status changes.
    """
    detector = get_detector_for_monitor(monitor)
    enabled = monitor.status == ObjectStatus.ACTIVE
    if detector and detector.enabled != enabled:
        detector.update(enabled=enabled)
