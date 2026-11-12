from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from snuba_sdk import Column, Condition, Direction, Entity, Op, OrderBy, Query
from snuba_sdk import Request as SnubaRequest

from sentry.models.project import Project
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import SnubaError, raw_snql_query

logger = logging.getLogger(__name__)

_SAMPLE_WINDOW_DAYS = 7
_SAMPLE_EVENT_LIMIT = 50


def sample_in_app_filenames(project: Project) -> list[str]:
    """Return deduplicated in-app stack filenames from a recent event sample.

    Queries the last _SAMPLE_WINDOW_DAYS days, newest _SAMPLE_EVENT_LIMIT events.
    Intended for reuse by M10 All-resolve health (VDY-225).
    Returns [] on Snuba error so callers remain functional.
    """
    now = datetime.now(UTC)
    start = now - timedelta(days=_SAMPLE_WINDOW_DAYS)

    query = (
        Query(Entity("events"))
        .set_select(
            [
                Column("exception_frames.filename"),
                Column("exception_frames.in_app"),
            ]
        )
        .set_where(
            [
                Condition(Column("project_id"), Op.EQ, project.id),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, now),
            ]
        )
        .set_orderby([OrderBy(Column("timestamp"), Direction.DESC)])
        .set_limit(_SAMPLE_EVENT_LIMIT)
    )
    request = SnubaRequest(
        dataset=Dataset.Events.value,
        app_id="default",
        tenant_ids={"organization_id": project.organization_id},
        query=query,
    )

    try:
        rows = raw_snql_query(request, referrer=Referrer.API_CODE_MAPPING_STACK_PREFIXES.value)[
            "data"
        ]
    except SnubaError:
        logger.exception(
            "stack_filename_sample.snuba_error",
            extra={"project_id": project.id},
        )
        return []

    return _extract_unique_filenames(rows)


def _extract_unique_filenames(rows: list[dict[str, Any]]) -> list[str]:
    seen: set[str] = set()
    for row in rows:
        filenames = row.get("exception_frames.filename") or []
        in_app_flags = row.get("exception_frames.in_app") or []
        for filename, in_app in zip(filenames, in_app_flags):
            if in_app and filename and filename not in seen:
                seen.add(filename)
    return list(seen)
