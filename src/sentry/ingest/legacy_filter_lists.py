"""
The legacy inbound filters are newline lists that the project details API reads and
writes under ``filters:*`` keys and that live in ``sentry:*`` project options. They
move into custom inbound filter rows one list at a time. The option
``relay.inbound-filters.legacy-list-stage`` holds the stage of each list, and this
module is the only place that knows which store is live. Relay config, the project
serializer, the project details endpoint and project settings copy all read and
write a list through it.

A list maps to one row per project, found by ``legacy_filter``: the id Relay reports
the outcomes of that legacy filter under. The row holds one condition whose value is
the full line list, in order and comment lines included, so the text round-trips.

Stages, in order:

- ``off``: the option is the only store. Today's behavior.
- ``mirror``: every write updates the option and the row together. Reads come from
  the option and a metric counts whether the row agrees. The row is hidden from
  Relay and from the custom filter API, so nothing is served twice.
- ``rows``: reads come from the row. Not implemented yet.
- ``v2``: Relay receives the row as a generic filter under its legacy id and the
  custom filter API shows it. Not implemented yet.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from django.db import router, transaction
from django.db.models import QuerySet

from sentry import options
from sentry.models.custominboundfilter import (
    ConditionType,
    CustomInboundFilter,
    DataType,
    LegacyFilter,
)
from sentry.models.project import Project
from sentry.utils import metrics

STAGE_OPTION = "relay.inbound-filters.legacy-list-stage"


class LegacyFilterList(StrEnum):
    """The legacy lists, named like the ``sentry:*`` option that holds them."""

    RELEASES = "releases"
    ERROR_MESSAGES = "error_messages"
    LOG_MESSAGES = "log_messages"
    TRACE_METRIC_NAMES = "trace_metric_names"

    @property
    def option_key(self) -> str:
        return f"sentry:{self.value}"


class Stage(StrEnum):
    OFF = "off"
    MIRROR = "mirror"
    ROWS = "rows"
    V2 = "v2"

    def at_least(self, other: Stage) -> bool:
        return _STAGE_ORDER.index(self) >= _STAGE_ORDER.index(other)


_STAGE_ORDER = [Stage.OFF, Stage.MIRROR, Stage.ROWS, Stage.V2]


def stage(legacy_list: LegacyFilterList) -> Stage:
    """A value the option does not know, a typo for example, counts as ``off``."""
    try:
        return Stage(options.get(STAGE_OPTION).get(legacy_list.value))
    except ValueError:
        return Stage.OFF


@dataclass(frozen=True)
class _Row:
    legacy_filter: LegacyFilter
    name: str
    data_type: DataType
    condition_type: ConditionType


# Relay's legacy release filter reads the release of every item type, so its row uses
# the catch-all data type. The name is only the initial one; a user may rename the row.
_ROWS: Mapping[LegacyFilterList, _Row] = {
    LegacyFilterList.RELEASES: _Row(
        LegacyFilter.RELEASE_VERSION, "Releases", DataType.ALL, ConditionType.RELEASE
    ),
    LegacyFilterList.ERROR_MESSAGES: _Row(
        LegacyFilter.ERROR_MESSAGE, "Error Messages", DataType.ERROR, ConditionType.ERROR_MESSAGE
    ),
    LegacyFilterList.LOG_MESSAGES: _Row(
        LegacyFilter.LOG_MESSAGE, "Log Messages", DataType.LOG, ConditionType.LOG_MESSAGE
    ),
    LegacyFilterList.TRACE_METRIC_NAMES: _Row(
        LegacyFilter.TRACE_METRIC_NAME, "Metric Names", DataType.METRIC, ConditionType.METRIC_NAME
    ),
}
_LIST_BY_LEGACY_FILTER = {
    row.legacy_filter.value: legacy_list for legacy_list, row in _ROWS.items()
}


def get_list(project: Project, legacy_list: LegacyFilterList) -> list[str]:
    """The lines of one legacy list of a project."""
    project_options = {legacy_list.option_key: project.get_option(legacy_list.option_key)}
    return get_lists([project], {project.id: project_options})[project.id][legacy_list]


def get_lists(
    projects: Sequence[Project], options_by_project: Mapping[int, Mapping[str, Any]]
) -> dict[int, dict[LegacyFilterList, list[str]]]:
    """
    The lines of every legacy list of each project. ``options_by_project`` must hold
    the ``sentry:*`` options of the projects, as the project serializer loads them.
    """
    lists: dict[int, dict[LegacyFilterList, list[str]]] = {}
    for project in projects:
        project_options = options_by_project.get(project.id, {})
        lists[project.id] = {
            legacy_list: list(project_options.get(legacy_list.option_key) or [])
            for legacy_list in LegacyFilterList
        }

    mirrored = [
        legacy_list for legacy_list in LegacyFilterList if stage(legacy_list).at_least(Stage.MIRROR)
    ]
    if mirrored:
        rows = _mirror_rows([project.id for project in projects], mirrored)
        for project_id, project_lists in lists.items():
            for legacy_list in mirrored:
                row = rows.get((project_id, legacy_list))
                row_lines = _lines(row, legacy_list) if row is not None else []
                metrics.incr(
                    "inbound_filters.legacy_list.compared",
                    tags={
                        "list": legacy_list.value,
                        "match": project_lists[legacy_list] == row_lines,
                    },
                )
    return lists


def set_list(project: Project, legacy_list: LegacyFilterList, lines: Sequence[str]) -> None:
    """
    Replaces the lines of one legacy list. ``lines`` must already be cleaned the way
    the API cleans newline input. Below the mirror stage only the option changes; from
    it on the option and the row change together or not at all.
    """
    lines = list(lines)
    if not stage(legacy_list).at_least(Stage.MIRROR):
        project.update_option(legacy_list.option_key, lines)
        return

    with transaction.atomic(router.db_for_write(CustomInboundFilter)):
        project.update_option(legacy_list.option_key, lines)
        _set_row(project, legacy_list, lines)


def copy_lists(source: Project, target: Project) -> None:
    """Copies the lists the source has. A list the source lacks stays as it is on the target."""
    for legacy_list in LegacyFilterList:
        lines = get_list(source, legacy_list)
        if lines:
            set_list(target, legacy_list, lines)


def without_hidden_rows(
    queryset: QuerySet[CustomInboundFilter],
) -> QuerySet[CustomInboundFilter]:
    """
    Drops the rows of lists that Relay and the custom filter API must not see yet,
    because the legacy path still serves them. From the v2 stage on a list's row is
    an ordinary custom filter.
    """
    hidden = [
        row.legacy_filter.value
        for legacy_list, row in _ROWS.items()
        if not stage(legacy_list).at_least(Stage.V2)
    ]
    if not hidden:
        return queryset
    return queryset.exclude(legacy_filter__in=hidden)


def _mirror_rows(
    project_ids: Sequence[int], lists: Sequence[LegacyFilterList]
) -> dict[tuple[int, LegacyFilterList], CustomInboundFilter]:
    rows = CustomInboundFilter.objects.filter(
        project_id__in=project_ids,
        legacy_filter__in=[_ROWS[legacy_list].legacy_filter.value for legacy_list in lists],
    )
    return {
        (row.project_id, _LIST_BY_LEGACY_FILTER[row.legacy_filter]): row
        for row in rows
        if row.legacy_filter is not None
    }


def _lines(row: CustomInboundFilter, legacy_list: LegacyFilterList) -> list[str]:
    condition_type = _ROWS[legacy_list].condition_type.value
    return [
        value
        for condition in row.conditions
        if condition.get("type") == condition_type
        for value in condition.get("value", [])
    ]


def _set_row(project: Project, legacy_list: LegacyFilterList, lines: list[str]) -> None:
    row = _ROWS[legacy_list]
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
