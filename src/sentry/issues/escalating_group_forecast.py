"""
This module represents a group's escalating forecast and has the logic to retrieve/store it in
Sentry's NodeStore. The forecasts are stored for 2 weeks.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional, TypedDict, cast

from sentry import nodestore
from sentry.utils.dates import parse_timestamp

GROUP_FORECAST_TTL = 14
ONE_EVENT_FORECAST = [10] * 14


class EscalatingGroupForecastData(TypedDict):
    project_id: int
    group_id: int
    forecast: List[int]
    date_added: float


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EscalatingGroupForecast:
    """
    This class represents a group's escalating forecast and has the logic to retrieve/store it in
    Sentry's NodeStore.
    """

    project_id: int
    group_id: int
    forecast: List[int]
    date_added: datetime

    def save(self) -> None:
        nodestore.set(
            self.build_storage_identifier(self.project_id, self.group_id),
            self.to_dict(),
            ttl=timedelta(GROUP_FORECAST_TTL),
        )

    @classmethod
    def fetch(cls, project_id: int, group_id: int) -> Optional[EscalatingGroupForecast]:
        """
        Return the forecast from nodestore if it exists.
        If it does not exist, it is because the TTL expired and the issue has not been seen in 7
        days. Generate the forecast in a task, and return the forecast for one event.
        """
        from sentry.issues.forecasts import generate_and_save_missing_forecasts

        results = nodestore.get(cls.build_storage_identifier(project_id, group_id))
        if results:
            return EscalatingGroupForecast.from_dict(results)
        logger.exception(
            f"Forecast does not exist for project id: {str(project_id)} group id: {str(group_id)}"
        )
        generate_and_save_missing_forecasts.delay(group_id=group_id)
        return EscalatingGroupForecast(
            project_id=project_id,
            group_id=group_id,
            forecast=ONE_EVENT_FORECAST,
            date_added=datetime.now(),
        )

    @classmethod
    def fetch_todays_forecast(cls, project_id: int, group_id: int) -> Optional[int]:
        date_now = datetime.now().date()
        escalating_forecast = EscalatingGroupForecast.fetch(project_id, group_id)

        if not escalating_forecast:
            return None

        forecast_today_index = (date_now - escalating_forecast.date_added.date()).days
        if forecast_today_index >= len(escalating_forecast.forecast):
            logger.error("Forecast list index is out of range")
            # Use last available forecast as a fallback
            forecast_today_index = -1
        return escalating_forecast.forecast[forecast_today_index]

    @classmethod
    def build_storage_identifier(cls, project_id: int, group_id: int) -> str:
        identifier = hashlib.md5(f"{project_id}::{group_id}".encode()).hexdigest()
        return f"e-g-f:{identifier}"

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
