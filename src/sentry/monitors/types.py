from dataclasses import dataclass
from datetime import datetime
from typing import Literal, NotRequired, TypedDict, Union

from django.utils.functional import cached_property
from django.utils.text import slugify
from sentry_kafka_schemas.schema_types.ingest_monitors_v1 import CheckIn

from sentry.monitors.constants import MAX_SLUG_LENGTH


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
    monitor_config: NotRequired[dict]
    contexts: NotRequired[CheckinContexts]


@dataclass
class CheckinItem:
    """
    Represents a check-in to be processed
    """

    ts: datetime
    """
    The timestamp the check-in was produced into the kafka topic. This differs
    from the start_time that is part of the CheckIn
    """

    partition: int
    """
    The kafka partition id the check-in was produced into.
    """

    message: CheckIn
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

    @property
    def processing_key(self):
        """
        This key is used to uniquely identify the check-in group this check-in
        belongs to. Check-ins grouped together will never be processed in
        parallel with other check-ins belonging to the same group
        """
        project_id = self.message["project_id"]
        env = self.payload.get("environment")
        return f"{project_id}:{self.valid_monitor_slug}:{env}"


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
