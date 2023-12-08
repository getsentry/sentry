from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Literal, TypedDict, Union

from django.utils.functional import cached_property
from django.utils.text import slugify
from typing_extensions import NotRequired

from sentry.monitors.constants import MAX_SLUG_LENGTH


class CheckinMessage(TypedDict):
    message_type: Literal["check_in"]
    payload: str
    start_time: float
    project_id: str
    sdk: str


class ClockPulseMessage(TypedDict):
    message_type: Literal["clock_pulse"]


class CheckinTrace(TypedDict):
    trace_id: str


class CheckinContexts(TypedDict):
    trace: NotRequired[CheckinTrace]


class CheckinPayload(TypedDict):
    check_in_id: str
    monitor_slug: str
    status: str
    environment: NotRequired[str]
    duration: NotRequired[int]
    monitor_config: NotRequired[Dict]
    contexts: NotRequired[CheckinContexts]


@dataclass
class CheckinItem:
    """
    Represents a check-in to be processed
    """

    ts: datetime
    """
    The timestamp the check-in was produced into the kafka topic. This differs
    from the start_time that is part of the CheckinMessage
    """

    partition: int
    """
    The kafka partition id the check-in was produced into.
    """

    message: CheckinMessage
    """
    The original unpacked check-in message contents.
    """

    payload: CheckinPayload
    """
    The json-decoded check-in payload contained within the message. Includes
    the full check-in details.
    """

    @cached_property
    def valid_monitor_slug(self):
        return slugify(self.payload["monitor_slug"])[:MAX_SLUG_LENGTH].strip("-")


IntervalUnit = Literal["year", "month", "week", "day", "hour", "minute"]


@dataclass
class CrontabSchedule:
    crontab: str
    type: Literal["crontab"] = "crontab"


@dataclass
class IntervalSchedule:
    interval: int
    unit: IntervalUnit
    type: Literal["interval"] = "interval"


ScheduleConfig = Union[CrontabSchedule, IntervalSchedule]
