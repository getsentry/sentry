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
set, so a list is never served or shown twice.

At the ``v2`` stage reads come from the row. Relay config and the project details API render
it, and the custom inbound filter API lists it with ``legacyFilter`` set, so a client can
tell it apart and keep it to one condition. Writes still update the option, so a step
back to an earlier stage loses nothing. Relay keeps receiving the list in its legacy
shape under its legacy id, so filter outcome stats keep their reason.

The option applies to every organization. Two feature flags lift an organization past it
for every list at once: ``organizations:inbound-filters-legacy-double-write`` from ``off``
to ``double_write``, and ``organizations:inbound-filters-v2`` to ``v2``.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from enum import StrEnum

from django.db import router, transaction

from sentry import features, options
from sentry.ingest.inbound_filters import FilterTypes
from sentry.models.custominboundfilter import (
    ConditionType,
    CustomInboundFilter,
    DataType,
    LegacyFilter,
)
from sentry.models.organization import Organization
from sentry.models.project import Project

STAGE_OPTION = "custom-inbound-filters.legacy-filter-stage"
DOUBLE_WRITE_FLAG = "organizations:inbound-filters-legacy-double-write"
V2_FLAG = "organizations:inbound-filters-v2"


class Stage(StrEnum):
    OFF = "off"
    DOUBLE_WRITE = "double_write"
    V2 = "v2"


def stage(filter_type: str, organization: Organization) -> Stage:
    """A value the option does not know, a typo for example, counts as ``off``."""
    if features.has(V2_FLAG, organization):
        return Stage.V2
    try:
        configured = Stage(options.get(STAGE_OPTION).get(filter_type))
    except ValueError:
        configured = Stage.OFF
    if configured is Stage.OFF and features.has(DOUBLE_WRITE_FLAG, organization):
        return Stage.DOUBLE_WRITE
    return configured


@dataclass(frozen=True)
class _Row:
    legacy_filter: LegacyFilter
    name: str
    data_type: DataType
    condition_type: ConditionType
    # The project details API always lowercased the lines of this list.
    case_insensitive: bool = False


# Relay's legacy release filter reads the release of every item type, so its row uses the
# catch-all data type. The name is only the initial one; a user may rename the row.
_ROWS: dict[str, _Row] = {
    FilterTypes.RELEASES: _Row(
        LegacyFilter.RELEASE_VERSION,
        "Releases",
        DataType.ALL,
        ConditionType.RELEASE,
        case_insensitive=True,
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

_FILTER_TYPE_BY_LEGACY_FILTER = {row.legacy_filter.value: ft for ft, row in _ROWS.items()}

OPTION_KEYS = {f"sentry:{filter_type}" for filter_type in _ROWS}


def filter_type_of(legacy_filter: str) -> str:
    """The list a row with this ``legacy_filter`` holds."""
    return _FILTER_TYPE_BY_LEGACY_FILTER[legacy_filter]


def served_legacy_filters(organization: Organization) -> list[str]:
    """The ``legacy_filter`` ids of the rows the custom inbound filter API serves: those of
    the lists at the ``v2`` stage."""
    return [
        row.legacy_filter.value
        for filter_type, row in _ROWS.items()
        if stage(filter_type, organization) is Stage.V2
    ]


def clean_lines(filter_type: str, lines: Iterable[str]) -> list[str]:
    """The lines the way the project details API stores them: trimmed, blank ones dropped,
    and lowercased where that API always did so."""
    cleaned = []
    for line in lines:
        if _ROWS[filter_type].case_insensitive:
            line = line.lower()
        line = line.strip()
        if line:
            cleaned.append(line)
    return cleaned


def set_list(project: Project, filter_type: str, lines: Sequence[str]) -> None:
    """
    Replaces the lines of one legacy list. ``lines`` must already be cleaned, see
    ``clean_lines``. Past the ``off`` stage the option and the row change together or not
    at all.
    """
    lines = list(lines)
    option_key = f"sentry:{filter_type}"
    if stage(filter_type, project.organization) is Stage.OFF:
        project.update_option(option_key, lines)
        return

    with transaction.atomic(router.db_for_write(CustomInboundFilter)):
        project.update_option(option_key, lines)
        _set_row(project, _ROWS[filter_type], lines)


def _set_row(project: Project, row: _Row, lines: list[str]) -> None:
    existing = _get_row(project, row)

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


def _get_row(project: Project, row: _Row) -> CustomInboundFilter | None:
    return CustomInboundFilter.objects.filter(
        project_id=project.id, legacy_filter=row.legacy_filter.value
    ).first()


def _row_lines(row: CustomInboundFilter | None) -> list[str]:
    if row is None or not row.conditions:
        return []
    return list(row.conditions[0]["value"])


def get_lines(project: Project, filter_type: str) -> list[str]:
    """The stored lines of one list, from the store its stage reads."""
    if stage(filter_type, project.organization) is Stage.V2:
        return _row_lines(_get_row(project, _ROWS[filter_type]))
    return project.get_option(f"sentry:{filter_type}") or []


def get_applied_lines(project: Project, filter_type: str) -> list[str]:
    """The lines Relay enforces: none while the user has the row switched off."""
    if stage(filter_type, project.organization) is Stage.V2:
        row = _get_row(project, _ROWS[filter_type])
        return _row_lines(row) if row is not None and row.active else []
    return project.get_option(f"sentry:{filter_type}") or []


def read_rows(projects: Sequence[Project]) -> dict[int, dict[str, list[str]]]:
    """
    The stored lines of every list at the ``v2`` stage, keyed by project id and list name,
    read from the rows in one query. A list at an earlier stage is absent: the option still
    holds it.
    """
    by_project: dict[int, dict[str, list[str]]] = {}
    for project in projects:
        lists: dict[str, list[str]] = {
            filter_type: []
            for filter_type in _ROWS
            if stage(filter_type, project.organization) is Stage.V2
        }
        if lists:
            by_project[project.id] = lists
    if not by_project:
        return by_project

    rows = CustomInboundFilter.objects.filter(
        project_id__in=by_project, legacy_filter__isnull=False
    )
    for row in rows:
        if row.legacy_filter is None:
            continue
        lists = by_project[row.project_id]
        filter_type = filter_type_of(row.legacy_filter)
        if filter_type in lists:
            lists[filter_type] = _row_lines(row)
    return by_project
