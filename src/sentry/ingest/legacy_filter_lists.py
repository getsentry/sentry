"""
The legacy inbound filters are newline lists that the project details API reads and
writes under ``filters:*`` keys. They start out in project options. Once the option
``relay.inbound-filters.custom-filter-rows-only`` is on, each list lives in custom
inbound filter rows with a fixed name instead, and Relay only receives the rows.

A list maps to two rows per project: one active row with the plain lines, and one
inactive row with the lines that start with ``#``. The legacy format has no comment
syntax, so Relay never matched such a line and the inactive row keeps that behavior.

The backfill migration ``1181_backfill_custom_inbound_filters_from_legacy_lists``
writes the same names, so both must change together.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from django.db import router, transaction

from sentry import options
from sentry.models.custominboundfilter import ConditionType, CustomInboundFilter, DataType
from sentry.models.project import Project
from sentry.tasks.relay import schedule_invalidate_project_config

COMMENT_PREFIX = "#"
DISABLED_SUFFIX = " (disabled)"


class LegacyFilterList(StrEnum):
    """The legacy lists, named like the ``sentry:*`` option that held them."""

    RELEASES = "releases"
    ERROR_MESSAGES = "error_messages"
    LOG_MESSAGES = "log_messages"
    TRACE_METRIC_NAMES = "trace_metric_names"

    @property
    def option_key(self) -> str:
        return f"sentry:{self.value}"


@dataclass(frozen=True)
class _Row:
    name: str
    data_type: DataType
    condition_type: ConditionType

    @property
    def disabled_name(self) -> str:
        return self.name + DISABLED_SUFFIX


# Relay's legacy release filter reads the release of every item type, so its rows use
# the catch-all data type. The legacy IP list is not one of these lists: it stays a
# project option that every plan can use.
_ROWS: Mapping[LegacyFilterList, _Row] = {
    LegacyFilterList.RELEASES: _Row("Releases", DataType.ALL, ConditionType.RELEASE),
    LegacyFilterList.ERROR_MESSAGES: _Row(
        "Error Messages", DataType.ERROR, ConditionType.ERROR_MESSAGE
    ),
    LegacyFilterList.LOG_MESSAGES: _Row("Log Messages", DataType.LOG, ConditionType.LOG_MESSAGE),
    LegacyFilterList.TRACE_METRIC_NAMES: _Row(
        "Metric Names", DataType.METRIC, ConditionType.METRIC_NAME
    ),
}


def rows_only() -> bool:
    return options.get("relay.inbound-filters.custom-filter-rows-only")


def row_name(legacy_list: LegacyFilterList) -> str:
    return _ROWS[legacy_list].name


def get_legacy_lists(
    projects: Sequence[Project], options_by_project: Mapping[int, Mapping[str, Any]]
) -> dict[int, dict[LegacyFilterList, list[str]]]:
    """
    Returns the lines of every legacy list for each project. Before the switch they
    come from ``options_by_project``, which must hold the ``sentry:*`` options of the
    projects. After it, they come from the rows, and inactive rows render as ``#`` lines.
    """
    lists: dict[int, dict[LegacyFilterList, list[str]]] = {
        project.id: {legacy_list: [] for legacy_list in LegacyFilterList} for project in projects
    }

    if not rows_only():
        for project in projects:
            project_options = options_by_project.get(project.id, {})
            for legacy_list in LegacyFilterList:
                lists[project.id][legacy_list] = list(
                    project_options.get(legacy_list.option_key) or []
                )
        return lists

    lists_by_name = {}
    for legacy_list, row in _ROWS.items():
        lists_by_name[row.name] = legacy_list
        lists_by_name[row.disabled_name] = legacy_list

    rows = CustomInboundFilter.objects.filter(
        project_id__in=[project.id for project in projects], name__in=list(lists_by_name)
    ).order_by("-active", "id")
    seen: dict[int, set[str]] = defaultdict(set)
    for custom_filter in rows:
        # A user may have made a second row with the same name; the first one wins,
        # so that reads and writes always agree on the row.
        name = custom_filter.name
        if name is None or name in seen[custom_filter.project_id]:
            continue
        seen[custom_filter.project_id].add(name)

        legacy_list = lists_by_name[name]
        prefix = "" if custom_filter.active else f"{COMMENT_PREFIX} "
        lists[custom_filter.project_id][legacy_list] += [
            prefix + value for value in _values(custom_filter, _ROWS[legacy_list])
        ]
    return lists


def set_legacy_list(project: Project, legacy_list: LegacyFilterList, lines: Sequence[str]) -> None:
    """
    Replaces the lines of one legacy list. ``lines`` must already be cleaned the way
    the API cleans newline input.
    """
    if not rows_only():
        project.update_option(legacy_list.option_key, list(lines))
        return

    active: list[str] = []
    disabled: list[str] = []
    for line in lines:
        if line.startswith(COMMENT_PREFIX):
            line = line[len(COMMENT_PREFIX) :].strip()
            if line and line not in disabled:
                disabled.append(line)
        elif line not in active:
            active.append(line)

    row = _ROWS[legacy_list]
    with transaction.atomic(router.db_for_write(CustomInboundFilter)):
        _set_row(project, row, row.name, active=True, values=active)
        _set_row(project, row, row.disabled_name, active=False, values=disabled)
    schedule_invalidate_project_config(project_id=project.id, trigger="legacy_filter_lists")


def _values(custom_filter: CustomInboundFilter, row: _Row) -> list[str]:
    return [
        value
        for condition in custom_filter.conditions
        if condition.get("type") == row.condition_type
        for value in condition.get("value", [])
    ]


def _set_row(project: Project, row: _Row, name: str, active: bool, values: list[str]) -> None:
    existing = (
        CustomInboundFilter.objects.filter(project_id=project.id, name=name)
        .order_by("-active", "id")
        .first()
    )
    if not values:
        if existing is not None:
            existing.delete()
        return

    conditions = [{"type": row.condition_type.value, "value": values}]
    if existing is None:
        CustomInboundFilter.objects.create(
            project_id=project.id,
            name=name,
            active=active,
            data_type=row.data_type.value,
            conditions=conditions,
        )
    else:
        existing.update(active=active, data_type=row.data_type.value, conditions=conditions)
