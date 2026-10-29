from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.constants import ObjectStatus
from sentry.monitors.models import Monitor, get_detector_for_monitor

if TYPE_CHECKING:
    from sentry.workflow_engine.models import Detector


def update_monitor_status(monitor: Monitor, status: int) -> None:
    monitor.update(status=status)
    sync_cron_detector_enabled(monitor)


def sync_cron_detector_enabled(monitor: Monitor) -> None:
    detector = get_detector_for_monitor(monitor)
    enabled = monitor.status == ObjectStatus.ACTIVE
    if detector and detector.enabled != enabled:
        detector.update(enabled=enabled)


def sync_cron_detector_name_and_owner(monitor: Monitor) -> None:
    detector = get_detector_for_monitor(monitor)
    if detector is None:
        return
    changed = {
        field: getattr(monitor, field)
        for field in ("name", "owner_user_id", "owner_team_id")
        if getattr(detector, field) != getattr(monitor, field)
    }
    if changed:
        detector.update(**changed)


def sync_monitor_owner_from_detector(monitor: Monitor, detector: Detector) -> None:
    if (monitor.owner_user_id, monitor.owner_team_id) != (
        detector.owner_user_id,
        detector.owner_team_id,
    ):
        monitor.update(owner_user_id=detector.owner_user_id, owner_team_id=detector.owner_team_id)
