from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, NotRequired, TypedDict, Union

from django.utils.functional import cached_property
from django.utils.text import slugify
from sentry_kafka_schemas.schema_types.ingest_monitors_v1 import CheckIn

from sentry.db.models.fields.slug import DEFAULT_SLUG_MAX_LENGTH


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


class CheckinItemData(TypedDict):
    """
    See `CheckinItem` for definition
    """

    ts: str
    partition: int
    message: CheckIn
    payload: CheckinPayload


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
        return slugify(self.payload["monitor_slug"])[:DEFAULT_SLUG_MAX_LENGTH].strip("-")

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

    def to_dict(self) -> CheckinItemData:
        return {
            "ts": self.ts.isoformat(),
            "partition": self.partition,
            "message": self.message,
            "payload": self.payload,
        }

    @classmethod
    def from_dict(cls, data: CheckinItemData) -> CheckinItem:
        return cls(
            datetime.fromisoformat(data["ts"]),
            data["partition"],
            data["message"],
            data["payload"],
        )


class SimpleCheckIn(TypedDict):
    """
    A stripped down check in object
    """

    id: int
    date_added: datetime
    status: int


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
