from __future__ import annotations

from typing import Any

import pytest
from sentry_relay.processing import is_glob_match, validate_rule_condition

from sentry.ingest.inbound_filters import (
    FilterTypes,
    _custom_filter_condition,
    get_supported_condition_types,
)
from sentry.ingest.legacy_inbound_filters import (
    RELEASES_ROW_NAME,
    LegacyFilterRow,
    plan_legacy_rows,
)
from sentry.models.custominboundfilter import (
    CustomInboundFilterConditionType,
    CustomInboundFilterDataType,
)
from sentry.utils import json

LINE_SOURCES = [
    FilterTypes.ERROR_MESSAGES,
    FilterTypes.LOG_MESSAGES,
    FilterTypes.TRACE_METRIC_NAMES,
]
ALL_SOURCES = [FilterTypes.RELEASES, *LINE_SOURCES]


def release(values: list[str]) -> dict[str, Any]:
    return {"type": "release", "value": values}


def error_type(value: str) -> dict[str, Any]:
    return {"type": "error_type", "value": [value]}


def error_message(value: str) -> dict[str, Any]:
    return {"type": "error_message", "value": [value]}


@pytest.mark.parametrize("source", ALL_SOURCES)
@pytest.mark.parametrize("lines", [[], [""], ["   ", "\t"], ["#"], ["#   ", "# "]])
def test_empty_list_plans_no_rows(source: FilterTypes, lines: list[str]) -> None:
    assert plan_legacy_rows(source, lines) == []


def test_releases_become_one_catch_all_row() -> None:
    rows = plan_legacy_rows(FilterTypes.RELEASES, ["1.*", " 2.0.0 ", "1.*", "", "beta-*"])

    assert rows == [
        LegacyFilterRow(
            source=FilterTypes.RELEASES,
            line=None,
            name=RELEASES_ROW_NAME,
            active=True,
            data_type=CustomInboundFilterDataType.ALL,
            conditions=[release(["1.*", "2.0.0", "beta-*"])],
        )
    ]


def test_release_comment_lines_become_disabled_rows() -> None:
    rows = plan_legacy_rows(FilterTypes.RELEASES, ["1.*", "# 3.*", "#4.*", "#"])

    assert rows == [
        LegacyFilterRow(
            source=FilterTypes.RELEASES,
            line=None,
            name=RELEASES_ROW_NAME,
            active=True,
            data_type=CustomInboundFilterDataType.ALL,
            conditions=[release(["1.*"])],
        ),
        LegacyFilterRow(
            source=FilterTypes.RELEASES,
            line="# 3.*",
            name="3.*",
            active=False,
            data_type=CustomInboundFilterDataType.ALL,
            conditions=[release(["3.*"])],
        ),
        LegacyFilterRow(
            source=FilterTypes.RELEASES,
            line="#4.*",
            name="4.*",
            active=False,
            data_type=CustomInboundFilterDataType.ALL,
            conditions=[release(["4.*"])],
        ),
    ]


def test_releases_with_only_comments_plan_no_active_row() -> None:
    rows = plan_legacy_rows(FilterTypes.RELEASES, ["# 1.*"])

    assert [row.active for row in rows] == [False]


@pytest.mark.parametrize(
    ("source", "line", "data_type", "conditions"),
    [
        pytest.param(
            FilterTypes.LOG_MESSAGES,
            "*DEBUG*",
            CustomInboundFilterDataType.LOG,
            [{"type": "log_message", "value": ["*DEBUG*"]}],
            id="log_message",
        ),
        pytest.param(
            FilterTypes.TRACE_METRIC_NAMES,
            "checkout.*",
            CustomInboundFilterDataType.METRIC,
            [{"type": "metric_name", "value": ["checkout.*"]}],
            id="metric_name",
        ),
        pytest.param(
            FilterTypes.ERROR_MESSAGES,
            "*timeout*",
            CustomInboundFilterDataType.ERROR,
            [error_message("*timeout*")],
            id="error_message_without_type",
        ),
        pytest.param(
            FilterTypes.ERROR_MESSAGES,
            "TypeError: Cannot read*",
            CustomInboundFilterDataType.ERROR,
            [error_type("TypeError"), error_message("Cannot read*")],
            id="error_message_splits_at_the_type_separator",
        ),
        pytest.param(
            FilterTypes.ERROR_MESSAGES,
            "*Error: Loading chunk *",
            CustomInboundFilterDataType.ERROR,
            [error_type("*Error"), error_message("Loading chunk *")],
            id="error_type_can_be_a_glob",
        ),
        pytest.param(
            FilterTypes.ERROR_MESSAGES,
            "Error: a: b",
            CustomInboundFilterDataType.ERROR,
            [error_type("Error"), error_message("a: b")],
            id="error_message_splits_at_the_first_separator_only",
        ),
        pytest.param(
            FilterTypes.ERROR_MESSAGES,
            "*: *",
            CustomInboundFilterDataType.ERROR,
            [error_type("*"), error_message("*")],
            id="error_message_splits_wildcards",
        ),
        pytest.param(
            FilterTypes.ERROR_MESSAGES,
            "https://example.com/*",
            CustomInboundFilterDataType.ERROR,
            [error_message("https://example.com/*")],
            id="colon_without_space_is_not_a_separator",
        ),
        pytest.param(
            FilterTypes.ERROR_MESSAGES,
            ": leading separator",
            CustomInboundFilterDataType.ERROR,
            [error_message(": leading separator")],
            id="empty_type_is_not_split",
        ),
        pytest.param(
            FilterTypes.ERROR_MESSAGES,
            "Trailing:",
            CustomInboundFilterDataType.ERROR,
            [error_message("Trailing:")],
            id="trailing_colon_is_not_split",
        ),
    ],
)
def test_each_line_becomes_a_row(
    source: FilterTypes,
    line: str,
    data_type: CustomInboundFilterDataType,
    conditions: list[dict[str, Any]],
) -> None:
    assert plan_legacy_rows(source, [line]) == [
        LegacyFilterRow(
            source=source,
            line=line,
            name=line,
            active=True,
            data_type=data_type,
            conditions=conditions,
        )
    ]


@pytest.mark.parametrize("source", LINE_SOURCES)
def test_line_rows_keep_order_and_drop_blanks_and_duplicates(source: FilterTypes) -> None:
    rows = plan_legacy_rows(source, ["b*", "", " a* ", "b*", "   ", "c*", "a*"])

    assert [row.line for row in rows] == ["b*", "a*", "c*"]
    assert all(row.active for row in rows)


@pytest.mark.parametrize("source", LINE_SOURCES)
def test_comment_line_becomes_a_disabled_row(source: FilterTypes) -> None:
    [active, disabled, marker_without_space] = plan_legacy_rows(
        source, ["keep*", "# drop*", "#nospace*"]
    )

    assert active.active is True
    assert active.line == "keep*"

    assert disabled.active is False
    assert disabled.line == "# drop*"
    assert disabled.name == "drop*"
    assert disabled.conditions == plan_legacy_rows(source, ["drop*"])[0].conditions

    assert marker_without_space.active is False
    assert marker_without_space.line == "#nospace*"
    assert marker_without_space.name == "nospace*"


def test_commented_error_message_still_splits_the_type() -> None:
    [row] = plan_legacy_rows(FilterTypes.ERROR_MESSAGES, ["# TypeError: Cannot read*"])

    assert row.active is False
    assert row.conditions == [error_type("TypeError"), error_message("Cannot read*")]


def test_name_is_cut_to_the_column_length() -> None:
    line = "x" * 300
    [row] = plan_legacy_rows(FilterTypes.LOG_MESSAGES, [line])

    assert row.line == line
    assert len(row.name) == 256
    assert row.conditions == [{"type": "log_message", "value": [line]}]


CORPUS: dict[FilterTypes, list[str]] = {
    FilterTypes.RELEASES: ["1.*", "2.0.0", "# 3.*"],
    FilterTypes.ERROR_MESSAGES: [
        "*timeout*",
        "TypeError: Cannot read*",
        "*Error: Loading chunk *",
        "Error: a: b",
        "*: *",
        "https://example.com/*",
        "# OutOfMemoryError",
    ],
    FilterTypes.LOG_MESSAGES: ["*DEBUG*", "# noisy*"],
    FilterTypes.TRACE_METRIC_NAMES: ["checkout.*", "# test.*"],
}


@pytest.mark.parametrize("source", ALL_SOURCES)
def test_planned_rows_are_valid_custom_filters(source: FilterTypes) -> None:
    # Everything the backfill writes must pass the checks the API applies to a filter
    # a user creates, and translate to a condition Relay's parser accepts.
    rows = plan_legacy_rows(source, CORPUS[source])
    assert rows

    for row in rows:
        supported = get_supported_condition_types(row.data_type)
        for condition in row.conditions:
            assert CustomInboundFilterConditionType(condition["type"]) in supported
            assert condition["value"]
            assert all(isinstance(value, str) and value for value in condition["value"])

        relay_condition = _custom_filter_condition(row.conditions, row.data_type)
        assert relay_condition is not None
        validate_rule_condition(json.dumps(relay_condition))


def test_release_row_compiles_to_the_release_field_of_every_data_type() -> None:
    [row] = plan_legacy_rows(FilterTypes.RELEASES, ["1.*", "2.0.0"])

    assert _custom_filter_condition(row.conditions, row.data_type) == {
        "op": "or",
        "inner": [
            {"op": "glob", "name": "event.release", "value": ["1.*", "2.0.0"]},
            {
                "op": "glob",
                "name": "log.attributes.sentry.release.value",
                "value": ["1.*", "2.0.0"],
            },
            {
                "op": "glob",
                "name": "trace_metric.attributes.sentry.release.value",
                "value": ["1.*", "2.0.0"],
            },
            {
                "op": "glob",
                "name": "span.attributes.sentry.release.value",
                "value": ["1.*", "2.0.0"],
            },
        ],
    }


@pytest.mark.parametrize(
    ("source", "line", "expected"),
    [
        (
            FilterTypes.LOG_MESSAGES,
            "*DEBUG*",
            {"op": "glob", "name": "log.body", "value": ["*DEBUG*"]},
        ),
        (
            FilterTypes.TRACE_METRIC_NAMES,
            "checkout.*",
            {"op": "glob", "name": "trace_metric.name", "value": ["checkout.*"]},
        ),
    ],
)
def test_log_and_metric_rows_compile_to_the_legacy_generic_filter_shape(
    source: FilterTypes, line: str, expected: dict[str, Any]
) -> None:
    # The legacy lists already ship to Relay as exactly these generic filters, so a
    # migrated row must produce the same condition.
    [row] = plan_legacy_rows(source, [line])

    assert _custom_filter_condition(row.conditions, row.data_type) == expected


# --- Error message equivalence -------------------------------------------------------
#
# Relay's legacy error message filter globs the "{type}: {value}" text of each exception
# and the logentry message. The migrated rows glob type and value separately. The tests
# below run both against the same synthetic events, through a small evaluator of the
# DSL subset the rows compile to, and pin the cases where the two differ.


def _get(item: Any, path: str) -> Any:
    for part in path.split("."):
        if not isinstance(item, dict):
            return None
        item = item.get(part)
    return item


def _evaluate(condition: dict[str, Any], item: Any) -> bool:
    op = condition["op"]
    if op == "glob":
        value = _get(item, condition["name"])
        return isinstance(value, str) and any(
            is_glob_match(value, pattern, case_insensitive=True) for pattern in condition["value"]
        )
    if op == "or":
        return any(_evaluate(inner, item) for inner in condition["inner"])
    if op == "and":
        return all(_evaluate(inner, item) for inner in condition["inner"])
    if op == "any":
        elements = _get(item, condition["name"])
        return isinstance(elements, list) and any(
            _evaluate(condition["inner"], element) for element in elements
        )
    raise AssertionError(f"the rows should not compile to {op}")


def _legacy_error_message_matches(patterns: list[str], event: dict[str, Any]) -> bool:
    # Mirrors relay-filter/src/error_messages.rs.
    def matches(text: str) -> bool:
        return any(is_glob_match(text, pattern, case_insensitive=True) for pattern in patterns)

    logentry = _get(event, "event.logentry") or {}
    message = logentry.get("formatted") or logentry.get("message")
    if message and matches(message):
        return True

    for exception in _get(event, "event.exception.values") or []:
        ty = exception.get("ty") or ""
        value = exception.get("value") or ""
        text = value if not ty else ty if not value else f"{ty}: {value}"
        if matches(text):
            return True
    return False


def exception_event(*exceptions: tuple[str, str]) -> dict[str, Any]:
    return {
        "event": {"exception": {"values": [{"ty": ty, "value": value} for ty, value in exceptions]}}
    }


def message_event(formatted: str) -> dict[str, Any]:
    return {"event": {"logentry": {"formatted": formatted}}}


EVENTS: dict[str, dict[str, Any]] = {
    "type_error": exception_event(("TypeError", "Cannot read properties of undefined")),
    "type_error_other_case": exception_event(("typeerror", "CANNOT READ properties")),
    "value_only": exception_event(("", "boom")),
    "type_only": exception_event(("OutOfMemoryError", "")),
    "two_exceptions": exception_event(("ValueError", "bad input"), ("TypeError", "Cannot read y")),
    "chunk_load": exception_event(("Uncaught ChunkLoadError", "Loading chunk 3 failed")),
    "message_refused": message_event("Connection refused by upstream"),
    "message_looks_typed": message_event("TypeError: Cannot read properties of null"),
}

PATTERNS = [
    "TypeError: Cannot read*",
    "*Cannot read*",
    "TypeError*",
    "*refused*",
    "OutOfMemoryError",
    "boom",
    "*Error: Cannot*",
    "*Error: Loading chunk *",
    "ValueError: Cannot read*",
    "*undefined",
]

# (pattern, event) pairs where the migrated row matches differently from the legacy
# filter, with what the row does. Any other pair must match identically.
KNOWN_DIVERGENCES: dict[tuple[str, str], bool] = {
    # A split pattern needs an exception. Legacy also globbed the whole pattern against
    # a plain message that happens to be written as "Type: text".
    ("TypeError: Cannot read*", "message_looks_typed"): False,
    ("*Error: Cannot*", "message_looks_typed"): False,
    # The type and the value conditions each look at every exception on their own, so
    # a type from one exception and a value from another satisfy both. Legacy needed
    # them on the same exception.
    ("ValueError: Cannot read*", "two_exceptions"): True,
}


@pytest.mark.parametrize("event_id", EVENTS)
@pytest.mark.parametrize("pattern", PATTERNS)
def test_error_message_row_matches_like_the_legacy_filter(pattern: str, event_id: str) -> None:
    [row] = plan_legacy_rows(FilterTypes.ERROR_MESSAGES, [pattern])
    condition = _custom_filter_condition(row.conditions, row.data_type)
    assert condition is not None
    validate_rule_condition(json.dumps(condition))

    event = EVENTS[event_id]
    legacy = _legacy_error_message_matches([pattern], event)
    expected = KNOWN_DIVERGENCES.get((pattern, event_id), legacy)

    assert _evaluate(condition, event) is expected


def test_known_divergences_do_diverge() -> None:
    # Keeps the list above honest: every entry must differ from the legacy result, so a
    # mapping improvement that closes a gap has to remove its entry here too.
    for (pattern, event_id), expected in KNOWN_DIVERGENCES.items():
        assert _legacy_error_message_matches([pattern], EVENTS[event_id]) is not expected
