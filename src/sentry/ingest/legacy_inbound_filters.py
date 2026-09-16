"""
Maps the legacy newline-list inbound filters onto custom inbound filter rows.

A project stores each legacy filter as a list of lines under a project option:
``sentry:releases``, ``sentry:error_messages``, ``sentry:log_messages`` and
``sentry:trace_metric_names``. Custom inbound filters store one row per filter with
typed conditions instead. This module decides which rows stand in for a list, so that
the backfill and the write path that keeps both in sync agree on the mapping and the
mapping is tested once.

The mapping is:

- Releases become one row with a single ``release`` condition holding every line, on
  the catch-all data type. Relay's legacy release filter reads the release of every
  item type, and so does the catch-all.
- Error messages, log messages and metric names become one row per line, so each can
  be named, switched off and measured on its own.
- A line that starts with ``#`` becomes a row that is switched off. The legacy format
  has no comment syntax: Relay globs such a line against real data, where it never
  matches, so a disabled row changes nothing that Relay does while it keeps the text.

Legacy error message patterns glob the ``"{type}: {value}"`` text of an exception.
Relay's rule DSL cannot see that text, so a line with a ``: `` separator becomes an
``error_type`` and an ``error_message`` condition on one row. See the tests for the
cases where that is not identical to the legacy match.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from sentry.ingest.inbound_filters import FilterTypes
from sentry.models.custominboundfilter import (
    CustomInboundFilter,
    CustomInboundFilterConditionType,
    CustomInboundFilterDataType,
)

# Set on a project once its legacy lists have been copied to rows. While set, the
# Relay config is built from the rows alone, so a row the user deletes stays gone.
MIGRATED_OPTION = "sentry:inbound_filters_migrated"

COMMENT_PREFIX = "#"
RELEASES_ROW_NAME = "Releases"

_TYPE_SEPARATOR = ": "
_NAME_MAX_LENGTH: int = CustomInboundFilter._meta.get_field("name").max_length

Condition = dict[str, str | list[str]]


@dataclass(frozen=True)
class LegacyFilterRow:
    """A custom inbound filter row that stands in for a legacy list, or one line of it."""

    source: FilterTypes
    # The legacy line the row stands for. None for the row that holds a whole list.
    line: str | None
    name: str
    active: bool
    data_type: CustomInboundFilterDataType
    conditions: list[Condition]


def plan_legacy_rows(source: FilterTypes, lines: Iterable[str]) -> list[LegacyFilterRow]:
    """
    Returns the rows that stand in for a legacy filter list.

    Blank lines and repeated lines are dropped, as the legacy save path already does.
    The result is empty for an empty list, so a project without a legacy filter gets
    no row.
    """
    seen: set[str] = set()
    cleaned: list[str] = []
    for line in lines:
        line = line.strip()
        if line and line not in seen:
            seen.add(line)
            cleaned.append(line)

    if source == FilterTypes.RELEASES:
        return _plan_release_rows(cleaned)
    return [_plan_line_row(source, line) for line in cleaned if _pattern_of(line)]


def _pattern_of(line: str) -> str:
    """The pattern a line carries, without a comment marker. Empty for a bare marker."""
    if line.startswith(COMMENT_PREFIX):
        return line[len(COMMENT_PREFIX) :].strip()
    return line


def _is_comment(line: str) -> bool:
    return line.startswith(COMMENT_PREFIX)


def _plan_release_rows(lines: list[str]) -> list[LegacyFilterRow]:
    active = [line for line in lines if not _is_comment(line)]
    disabled = [line for line in lines if _is_comment(line) and _pattern_of(line)]

    rows = []
    if active:
        rows.append(
            LegacyFilterRow(
                source=FilterTypes.RELEASES,
                line=None,
                name=RELEASES_ROW_NAME,
                active=True,
                data_type=CustomInboundFilterDataType.ALL,
                conditions=[_condition(CustomInboundFilterConditionType.RELEASE, active)],
            )
        )
    for line in disabled:
        rows.append(
            LegacyFilterRow(
                source=FilterTypes.RELEASES,
                line=line,
                name=_name_of(_pattern_of(line)),
                active=False,
                data_type=CustomInboundFilterDataType.ALL,
                conditions=[
                    _condition(CustomInboundFilterConditionType.RELEASE, [_pattern_of(line)])
                ],
            )
        )
    return rows


def _plan_line_row(source: FilterTypes, line: str) -> LegacyFilterRow:
    pattern = _pattern_of(line)
    data_type, conditions = _LINE_MAPPERS[source](pattern)
    return LegacyFilterRow(
        source=source,
        line=line,
        name=_name_of(pattern),
        active=not _is_comment(line),
        data_type=data_type,
        conditions=conditions,
    )


def _error_message_conditions(
    pattern: str,
) -> tuple[CustomInboundFilterDataType, list[Condition]]:
    ty, separator, value = pattern.partition(_TYPE_SEPARATOR)
    if separator and ty and value:
        conditions = [
            _condition(CustomInboundFilterConditionType.ERROR_TYPE, [ty]),
            _condition(CustomInboundFilterConditionType.ERROR_MESSAGE, [value]),
        ]
    else:
        conditions = [_condition(CustomInboundFilterConditionType.ERROR_MESSAGE, [pattern])]
    return CustomInboundFilterDataType.ERROR, conditions


def _log_message_conditions(
    pattern: str,
) -> tuple[CustomInboundFilterDataType, list[Condition]]:
    return CustomInboundFilterDataType.LOG, [
        _condition(CustomInboundFilterConditionType.LOG_MESSAGE, [pattern])
    ]


def _metric_name_conditions(
    pattern: str,
) -> tuple[CustomInboundFilterDataType, list[Condition]]:
    return CustomInboundFilterDataType.METRIC, [
        _condition(CustomInboundFilterConditionType.METRIC_NAME, [pattern])
    ]


_LINE_MAPPERS = {
    FilterTypes.ERROR_MESSAGES: _error_message_conditions,
    FilterTypes.LOG_MESSAGES: _log_message_conditions,
    FilterTypes.TRACE_METRIC_NAMES: _metric_name_conditions,
}


def _condition(condition_type: CustomInboundFilterConditionType, values: list[str]) -> Condition:
    return {"type": condition_type.value, "value": values}


def _name_of(pattern: str) -> str:
    return pattern[:_NAME_MAX_LENGTH]
