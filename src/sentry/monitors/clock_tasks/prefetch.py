from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from django.db.models import OuterRef, Subquery
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import MonitorsClockTasks

from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorEnvironment


@dataclass
class ClockTaskPrefetch:
    """Reads bulk-loaded for an entire batch of clock tasks."""

    checkins: dict[int, MonitorCheckIn] = field(default_factory=dict)
    """Check-ins referenced by mark_timeout tasks, by id."""

    monitor_environments: dict[int, MonitorEnvironment] = field(default_factory=dict)
    """Monitor environments referenced by mark_missing tasks, by id."""

    newest_status_affecting: dict[int, datetime] = field(default_factory=dict)
    """Most recent OK/ERROR check-in per monitor environment."""

    def has_newer_status_affecting_checkin(
        self, monitor_environment_id: int, timestamp: datetime
    ) -> bool:
        newest = self.newest_status_affecting.get(monitor_environment_id)
        return newest is not None and newest > timestamp


def prefetch_clock_tasks(
    task_mapping: dict[int, list[MonitorsClockTasks]],
) -> ClockTaskPrefetch:
    """
    Bulk-load the reads a batch of clock tasks will need.

    Reads only -- writes stay in the per-environment path, which is ordered.
    """
    prefetch = ClockTaskPrefetch()

    canonical_environments: dict[int, MonitorEnvironment] = {}
    timeout_checkin_ids: set[int] = set()
    missing_env_ids: set[int] = set()

    for monitor_environment_id, tasks in task_mapping.items():
        for task in tasks:
            if task["type"] == "mark_timeout":
                timeout_checkin_ids.add(int(task["checkin_id"]))
            elif task["type"] == "mark_missing":
                missing_env_ids.add(monitor_environment_id)

    if timeout_checkin_ids:
        prefetch.checkins = {
            checkin.id: checkin
            for checkin in MonitorCheckIn.objects.select_related(
                "monitor_environment", "monitor_environment__monitor"
            ).filter(id__in=timeout_checkin_ids)
        }
        # Tasks in a group mutate the environment row, so they must share one
        # instance. `select_related` gives each check-in its own.
        for checkin in prefetch.checkins.values():
            canonical = canonical_environments.setdefault(
                checkin.monitor_environment_id, checkin.monitor_environment
            )
            checkin.monitor_environment = canonical

    if prefetch.checkins:
        env_ids = {checkin.monitor_environment_id for checkin in prefetch.checkins.values()}

        # Safe floor: every date compared later is itself >= this.
        oldest = min(checkin.date_added for checkin in prefetch.checkins.values())

        newest_checkin = (
            MonitorCheckIn.objects.filter(
                monitor_environment_id=OuterRef("id"),
                status__in=[CheckInStatus.OK, CheckInStatus.ERROR],
                date_added__gt=oldest,
            )
            .order_by("-date_added")
            .values("date_added")[:1]
        )
        prefetch.newest_status_affecting = {
            environment_id: newest
            for environment_id, newest in MonitorEnvironment.objects.filter(id__in=env_ids)
            .annotate(newest=Subquery(newest_checkin))
            .values_list("id", "newest")
            if newest is not None
        }

    if missing_env_ids:
        from sentry.monitors.clock_tasks.check_missed import IGNORE_MONITORS

        for monitor_environment in MonitorEnvironment.objects.select_related("monitor").filter(
            IGNORE_MONITORS,
            id__in=missing_env_ids,
        ):
            prefetch.monitor_environments[monitor_environment.id] = (
                canonical_environments.setdefault(monitor_environment.id, monitor_environment)
            )

    return prefetch
