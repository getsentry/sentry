from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional, TypedDict, cast

from sentry import nodestore
from sentry.utils.dates import parse_timestamp

TWO_WEEKS_IN_DAYS = 14


class EscalatingGroupForecastData(TypedDict):
    project_id: int
    group_id: int
    forecast: List[int]
    date_added: float


@dataclass(frozen=True)
class EscalatingGroupForecast:
    """
    A class representing a group's escalating forecast.
    """

    project_id: int
    group_id: int
    forecast: List[int]
    date_added: datetime

    def to_dict(
        self,
    ) -> EscalatingGroupForecastData:
        return {
            "project_id": self.project_id,
            "group_id": self.group_id,
            "forecast": self.forecast,
            "date_added": self.date_added.timestamp(),
        }

    @classmethod
    def from_dict(cls, data: EscalatingGroupForecastData) -> EscalatingGroupForecast:
        return cls(
            data["project_id"],
            data["group_id"],
            data["forecast"],
            cast(datetime, parse_timestamp(data["date_added"])),
        )

    @classmethod
    def build_storage_identifier(cls, project_id: int, group_id: int) -> str:
        identifier = hashlib.md5(f"{project_id}::{group_id}".encode()).hexdigest()
        return f"e-g-f:{identifier}"

    def save(self) -> None:
        nodestore.set(
            self.build_storage_identifier(self.project_id, self.group_id),
            self.to_dict(),
            ttl=timedelta(TWO_WEEKS_IN_DAYS),
        )

    @classmethod
    def fetch(cls, project_id: int, group_id: int) -> Optional[EscalatingGroupForecast]:
        results = nodestore.get(cls.build_storage_identifier(project_id, group_id))
        if results:
            return EscalatingGroupForecast.from_dict(results)
        return None
