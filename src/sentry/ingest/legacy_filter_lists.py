"""
The legacy inbound filters are newline lists in ``sentry:*`` project options, written by
the project details API under ``filters:*`` keys. They move into custom inbound filter
rows one list at a time. The option ``custom-inbound-filters.legacy-filter-stage`` holds the
stage of each list, keyed by the list name in ``FilterTypes``.

A list maps to one row per project, found by ``legacy_filter``: the id Relay reports the
outcomes of that legacy filter under. The row holds one condition whose value is the full
line list, in order and comment lines included, so the text round-trips.

At the ``double_write`` stage every write updates the option and the row together. Reads stay
on the option, and readers of the custom filter table skip rows with ``legacy_filter``
set, so a list is never served or shown twice. The ``rows`` and ``v2`` stages come later.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from django.db import router, transaction

from sentry import options
from sentry.ingest.inbound_filters import FilterTypes
from sentry.models.custominboundfilter import (
    ConditionType,
    CustomInboundFilter,
    DataType,
    LegacyFilter,
)
from sentry.models.project import Project

STAGE_OPTION = "custom-inbound-filters.legacy-filter-stage"


class Stage(StrEnum):
    OFF = "off"
    DOUBLE_WRITE = "double_write"


def stage(filter_type: str) -> Stage:
    """A value the option does not know, a typo for example, counts as ``off``."""
    try:
        return Stage(options.get(STAGE_OPTION).get(filter_type))
    except ValueError:
        return Stage.OFF


@dataclass(frozen=True)
class _Row:
    legacy_filter: LegacyFilter
    name: str
    data_type: DataType
    condition_type: ConditionType


# Relay's legacy release filter reads the release of every item type, so its row uses the
# catch-all data type. The name is only the initial one; a user may rename the row.
_ROWS: dict[str, _Row] = {
    FilterTypes.RELEASES: _Row(
        LegacyFilter.RELEASE_VERSION, "Releases", DataType.ALL, ConditionType.RELEASE
    ),
    FilterTypes.ERROR_MESSAGES: _Row(
        LegacyFilter.ERROR_MESSAGE, "Error Messages", DataType.ERROR, ConditionType.ERROR_MESSAGE
    ),
    FilterTypes.LOG_MESSAGES: _Row(
        LegacyFilter.LOG_MESSAGE, "Log Messages", DataType.LOG, ConditionType.LOG_MESSAGE
    ),
    FilterTypes.TRACE_METRIC_NAMES: _Row(
        LegacyFilter.TRACE_METRIC_NAME, "Metric Names", DataType.METRIC, ConditionType.METRIC_NAME
    ),
}

OPTION_KEYS = {f"sentry:{filter_type}" for filter_type in _ROWS}


def set_list(project: Project, filter_type: str, lines: Sequence[str]) -> None:
    """
    Replaces the lines of one legacy list. ``lines`` must already be cleaned the way the
    API cleans newline input. At the double write stage the option and the row change together
    or not at all.
    """
    lines = list(lines)
    option_key = f"sentry:{filter_type}"
    if stage(filter_type) != Stage.DOUBLE_WRITE:
        project.update_option(option_key, lines)
        return

    with transaction.atomic(router.db_for_write(CustomInboundFilter)):
        project.update_option(option_key, lines)
        _set_row(project, _ROWS[filter_type], lines)


def _set_row(project: Project, row: _Row, lines: list[str]) -> None:
    existing = CustomInboundFilter.objects.filter(
        project_id=project.id, legacy_filter=row.legacy_filter.value
    ).first()

    if not lines:
        if existing is not None:
            existing.delete()
        return

    conditions = [{"type": row.condition_type.value, "value": lines}]
    if existing is None:
        CustomInboundFilter.objects.create(
            project_id=project.id,
            name=row.name,
            data_type=row.data_type.value,
            conditions=conditions,
            legacy_filter=row.legacy_filter.value,
        )
    else:
        # The name and the active flag belong to the user, who may edit the row in the
        # custom filter UI. Only the lines follow the legacy list.
        existing.update(conditions=conditions)
