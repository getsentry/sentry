from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry.ingestion_delay.activity import has_accepted_outcomes
from sentry.ingestion_delay.query import get_measurement_lookback, measure_ingestion_delay

logger = logging.getLogger(__name__)

# Buffer for outlier ingestion delays.
STALL_MARGIN = timedelta(seconds=60)

# Buffer for projects just exiting idle.
STALL_GRACE = timedelta(minutes=5)


class IngestionStatus(StrEnum):
    HEALTHY = "healthy"
    STALLED = "stalled"
    IDLE = "idle"
    UNKNOWN = "unknown"


@dataclass(frozen=True)
class IngestionDelayStatus:
    delay_seconds: float | None
    complete_through: datetime | None
    status: IngestionStatus


def get_ingestion_delay_status(
    organization_id: int,
    project_ids: list[int],
    item_type: TraceItemType.ValueType,
) -> IngestionDelayStatus:
    """
    The measured delay, and the time through which data is believed complete.
    """
    now = datetime.now(tz=UTC)
    measurement = measure_ingestion_delay(organization_id, item_type, now)

    # Snuba query failure tells us nothing about the pipeline.
    if not measurement.succeeded:
        return IngestionDelayStatus(None, None, IngestionStatus.UNKNOWN)

    delay_seconds = measurement.delay_seconds
    last_ingested_at = measurement.last_ingested_at

    complete_through = now - timedelta(seconds=delay_seconds) if delay_seconds is not None else None

    def result(
        status: IngestionStatus, through: datetime | None = complete_through
    ) -> IngestionDelayStatus:
        return IngestionDelayStatus(delay_seconds, through, status)

    # The newest row is inside the window the expected delay accounts for.
    # STALL_MARGIN adds some tolerance for ingestion slow downs and also covers other sources
    # of pipeline delays not captured in our attributes, like batch insert wait times.
    if (
        complete_through is not None
        and last_ingested_at is not None
        and last_ingested_at > complete_through - STALL_MARGIN
    ):
        return result(IngestionStatus.HEALTHY)

    # Either no data landed at all (idle), or the newest row is older than expected delay (stalled).
    # Check outcomes to determine if the pipeline is stalled or idle.
    # Add some buffer to account for outliers and projects just exiting idle.
    if delay_seconds is not None and last_ingested_at is not None:
        evidence_end = now - (timedelta(seconds=delay_seconds) + STALL_MARGIN)
        evidence_start = last_ingested_at
        if evidence_end <= evidence_start:
            return result(IngestionStatus.UNKNOWN, None)
    else:
        evidence_end = now - STALL_GRACE
        evidence_start = now - get_measurement_lookback()

    accepted = has_accepted_outcomes(
        organization_id=organization_id,
        project_ids=project_ids,
        item_type=item_type,
        start=evidence_start,
        end=evidence_end,
    )

    if accepted is None:
        logger.warning(
            "ingestion_delay.no_outcomes",
            extra={
                "organization_id": organization_id,
                "project_ids": project_ids,
                "item_type": item_type,
                "start": evidence_start,
                "end": evidence_end,
            },
        )
        return result(IngestionStatus.UNKNOWN, None)

    # Data was accepted but has not been ingested, therefore the pipeline is stalled.
    if accepted:
        return result(IngestionStatus.STALLED, last_ingested_at)

    # No data was accepted, therefore projects are idle.
    return result(IngestionStatus.IDLE)
