from __future__ import annotations

import abc
import logging
from datetime import datetime, timedelta

from cronsim import CronSim, CronSimError
from django.utils import timezone

from sentry.conf.types.taskworker import crontab

logger = logging.getLogger("taskworker.scheduler")


class Schedule(metaclass=abc.ABCMeta):
    """Interface for scheduling tasks to run at specific times."""

    @abc.abstractmethod
    def is_due(self, last_run: datetime | None = None) -> bool:
        """
        Check if the schedule is due to run again based on last_run.
        """

    @abc.abstractmethod
    def remaining_seconds(self, last_run: datetime | None = None) -> int:
        """
        Get the remaining seconds until the schedule should run again.
        """

    @abc.abstractmethod
    def runtime_after(self, start: datetime) -> datetime:
        """
        Get the next scheduled time after `start`
        """


class TimedeltaSchedule(Schedule):
    """
    Task schedules defined as `datetime.timedelta` intervals

    If a timedelta interval loses it's last_run state, it will assume
    that at least one interval has been missed, and it will become due immediately.

    After the first spawn, the schedule will align to to the interval's duration.
    """

    def __init__(self, delta: timedelta) -> None:
        self._delta = delta
        if delta.microseconds:
            raise ValueError("microseconds are not supported")
        if delta.total_seconds() < 0:
            raise ValueError("interval must be at least one second")

    def is_due(self, last_run: datetime | None = None) -> bool:
        """Check if the schedule is due to run again based on last_run."""
        if last_run is None:
            return True
        remaining = self.remaining_seconds(last_run)
        return remaining <= 0

    def remaining_seconds(self, last_run: datetime | None = None) -> int:
        """The number of seconds remaining until the next task should spawn"""
        if last_run is None:
            return 0
        # floor to timestamp as microseconds are not relevant
        now = int(timezone.now().timestamp())
        last_run_ts = int(last_run.timestamp())

        seconds_remaining = self._delta.total_seconds() - (now - last_run_ts)
        return max(int(seconds_remaining), 0)

    def runtime_after(self, start: datetime) -> datetime:
        """Get the next time a task should run after start"""
        return start + self._delta


class CrontabSchedule(Schedule):
    """
    Task schedules defined as crontab expressions.

    crontab expressions naturally align to clock intervals. For example
    an interval of `crontab(minute="*/2")` will spawn on the even numbered minutes.

    If a crontab schedule loses its last_run state, it will assume that
    one or more intervals have been missed, and it will align to the next
    interval window. Missed intervals will not be recovered.

    For tasks with very long intervals, you should consider the impact of a deploy
    or scheduler restart causing a missed window. Consider a more frequent interval
    to help spread load out and reduce the impacts of missed intervals.
    """

    def __init__(self, name: str, crontab: crontab) -> None:
        self._crontab = crontab
        self._name = name
        try:
            self._cronsim = CronSim(str(crontab), timezone.now())
        except CronSimError as e:
            raise ValueError(f"crontab expression {self._crontab} is invalid") from e

    def is_due(self, last_run: datetime | None = None) -> bool:
        """Check if the schedule is due to run again based on last_run."""
        if last_run is None:
            return True
        remaining = self.remaining_seconds(last_run)
        return remaining <= 0

    def remaining_seconds(self, last_run: datetime | None = None) -> int:
        """
        Get the number of seconds until this schedule is due again

        Use the current time to find the next schedule time
        """
        if last_run is None:
            return 0

        # This could result in missed beats, or increased load on redis.
        last_run = last_run.replace(second=0, microsecond=0)
        now = timezone.now().replace(second=0, microsecond=0)

        # A future last_run means we should wait until the
        # next scheduled time, and then we can try again.
        # we could be competing with another scheduler, or
        # missing beats.
        if last_run > now:
            logger.warning(
                "taskworker.scheduler.future_value",
                extra={
                    "task": self._name,
                    "last_run": last_run,
                    "now": now,
                },
            )
            next_run = self._advance(last_run + timedelta(minutes=1))
            return int(next_run.timestamp() - now.timestamp())

        # If last run is in the past, see if the next runtime
        # is in the future.
        if last_run < now:
            next_run = self._advance(last_run + timedelta(minutes=1))
            # Our next runtime is in the future, or now
            if next_run >= now:
                return int(next_run.timestamp() - now.timestamp())

            # still in the past, we missed an interval :(
            missed = next_run
            next_run = self._advance(now)
            logger.warning(
                "taskworker.scheduler.missed_interval",
                extra={
                    "task": self._name,
                    "last_run": last_run.isoformat(),
                    "missed": missed.isoformat(),
                    "now": now.isoformat(),
                    "next_run": next_run.isoformat(),
                },
            )
            return int(next_run.timestamp() - now.timestamp())

        # last_run == now, we are on the beat, find the next interval
        next_run = self._advance(now + timedelta(minutes=1))

        return int(next_run.timestamp() - now.timestamp())

    def _advance(self, dt: datetime) -> datetime:
        self._cronsim.dt = dt
        self._cronsim.advance()
        return self._cronsim.dt

    def runtime_after(self, start: datetime) -> datetime:
        """Get the next time a task should be spawned after `start`"""
        start = start.replace(second=0, microsecond=0) + timedelta(minutes=1)
        return self._advance(start)
