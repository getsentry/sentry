from __future__ import annotations

import dataclasses
from collections.abc import Mapping
from datetime import timedelta
from typing import TypedDict


@dataclasses.dataclass
class crontab:
    """
    crontab schedule value object

    Used in configuration to define a task schedule.

    :see sentry.taskworker.scheduler.schedules.CrontabSchedule for more details.
    """

    minute: str = "*"
    hour: str = "*"
    day_of_week: str = "*"
    day_of_month: str = "*"
    month_of_year: str = "*"

    def __str__(self) -> str:
        return (
            f"{self.minute} {self.hour} {self.day_of_month} {self.month_of_year} {self.day_of_week}"
        )


class ScheduleConfig(TypedDict):
    """The schedule definition for an individual task."""

    task: str
    schedule: timedelta | crontab


ScheduleConfigMap = Mapping[str, ScheduleConfig]
"""A collection of schedule configuration, usually defined in application configuration"""
