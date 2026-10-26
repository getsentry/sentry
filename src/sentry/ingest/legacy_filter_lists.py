"""
The legacy inbound filters are newline lists in ``sentry:*`` project options, written by
the project details API under ``filters:*`` keys. They also live in custom inbound filter
rows, so the custom filter table can take them over.

A list maps to one row per project, found by ``legacy_filter``: the id Relay reports the
outcomes of that legacy filter under. The row holds one condition whose value is the full
line list, in order and comment lines included, so the text round-trips.

Every write updates the option and the row together. Which store the reads use depends on
the organization: with ``organizations:inbound-filters-v2`` they read the row, and the
custom inbound filter API lists it with ``legacyFilter`` set, so a client can tell it apart
and keep it to one condition. Without the feature they read the option, and readers of
the custom filter table skip rows with ``legacy_filter`` set, so a list is never served or
shown twice. Relay receives the list in its legacy shape under its legacy id either way,
so filter outcome stats keep their reason.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from django.db import router, transaction

from sentry import features
from sentry.models.custominboundfilter import (
    ConditionType,
    CustomInboundFilter,
    DataType,
    LegacyFilter,
)
from sentry.models.organization import Organization
from sentry.models.project import Project


class FilterTypes:
    ERROR_MESSAGES = "error_messages"
    RELEASES = "releases"
    LOG_MESSAGES = "log_messages"
    TRACE_METRIC_NAMES = "trace_metric_names"


def has_inbound_filters_v2(organization: Organization) -> bool:
    """With the feature, the lists of the organization are read from their rows."""
    return features.has("organizations:inbound-filters-v2", organization)


@dataclass(frozen=True)
class _Row:
    legacy_filter: LegacyFilter
    name: str
    data_type: DataType
    condition_type: ConditionType
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

LEGACY_FILTERS = [row.legacy_filter.value for row in _ROWS.values()]


def filter_type_of(legacy_filter: str) -> str:
    """The list a row with this ``legacy_filter`` holds."""
    return _FILTER_TYPE_BY_LEGACY_FILTER[legacy_filter]


def list_name(legacy_filter: str) -> str:
    """The name of the list in the project settings, such as ``Error Messages``."""
    return _ROWS[filter_type_of(legacy_filter)].name


def served_legacy_filters(organization: Organization) -> list[str]:
    """The ``legacy_filter`` ids of the rows the custom inbound filter API serves."""
    return LEGACY_FILTERS if has_inbound_filters_v2(organization) else []


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
    ``clean_lines``. The option and the row change together or not at all.
    """
    lines = list(lines)
    with transaction.atomic(router.db_for_write(CustomInboundFilter)):
        project.update_option(f"sentry:{filter_type}", lines)
        _set_row(project, _ROWS[filter_type], lines)


def copy_lists(source: Project, target: Project) -> None:
    """Copies every list, and the name and the active flag of its row, onto ``target``."""
    for filter_type, row in _ROWS.items():
        set_list(target, filter_type, get_lines(source, filter_type))
        source_row = _get_row(source, row)
        target_row = _get_row(target, row)
        if source_row is not None and target_row is not None:
            target_row.update(name=source_row.name, active=source_row.active)


def _set_row(project: Project, row: _Row, lines: list[str]) -> None:
    existing = _get_row(project, row)

    if not lines:
        if existing is not None:
            existing.delete()
        return

    conditions = [{"type": row.condition_type.value, "operator": "glob", "value": lines}]
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
    """The stored lines of one list, from the store the organization reads."""
    if has_inbound_filters_v2(project.organization):
        return _row_lines(_get_row(project, _ROWS[filter_type]))
    return project.get_option(f"sentry:{filter_type}") or []


def get_applied_lines(project: Project, filter_type: str) -> list[str]:
    """The lines Relay enforces: none while the user has the row switched off."""
    if has_inbound_filters_v2(project.organization):
        row = _get_row(project, _ROWS[filter_type])
        return _row_lines(row) if row is not None and row.active else []
    return project.get_option(f"sentry:{filter_type}") or []


def read_rows(projects: Sequence[Project]) -> dict[int, dict[str, list[str]]]:
    """
    The stored lines of every list of the projects whose organization reads the rows, keyed
    by project id and list name, read in one query. A project whose organization reads the
    option is absent.
    """
    by_project: dict[int, dict[str, list[str]]] = {
        project.id: {filter_type: [] for filter_type in _ROWS}
        for project in projects
        if has_inbound_filters_v2(project.organization)
    }
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
