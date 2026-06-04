import pytest
from django.test import override_settings
from sentry_relay.processing import is_glob_match

from sentry.ingest.inbound_filters import (
    _chunk_load_error_filter,
    _custom_error_filter,
    _error_message_condition,
    get_generic_filters,
)
from sentry.models.project import Project
from sentry.testutils.pytest.fixtures import django_db_all

CUSTOM_PATTERNS: list[tuple[str | None, str | None]] = [
    ("MyError", "Something went wrong *"),
    (None, "*known flaky test*"),
]


def exception_matches_filters(
    exc_type: str,
    exc_message: str,
    patterns: list[tuple[str | None, str | None]],
) -> bool:
    """Same matching rules as _error_message_condition / Relay generic filters."""
    for type_pattern, message_pattern in patterns:
        if type_pattern is not None and not is_glob_match(exc_type, type_pattern):
            continue
        if message_pattern is not None and not is_glob_match(exc_message, message_pattern):
            continue
        return True
    return False


def message_matches_filters(
    message: str,
    patterns: list[tuple[str | None, str | None]],
) -> bool:
    """Matching rules for logentry messages: only type-less patterns apply."""
    for type_pattern, message_pattern in patterns:
        if type_pattern is not None or message_pattern is None:
            continue
        if is_glob_match(message, message_pattern):
            return True
    return False


def test_custom_error_filter_empty() -> None:
    # With no custom values configured, the filter is a no-op and must be omitted from
    # the Relay config entirely rather than emitting an empty condition.
    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=[]):
        condition = _custom_error_filter()

    assert condition is None
    assert not exception_matches_filters("MyError", "Something went wrong in checkout", [])


def test_custom_error_filter_builds_one_rule_per_pattern() -> None:
    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=CUSTOM_PATTERNS):
        condition = _custom_error_filter()

    # The custom filter matches exceptions AND messages: the exception branch iterates
    # over event.exception.values, while type-less patterns also glob the logentry message.
    assert condition == {
        "op": "or",
        "inner": [
            {
                "op": "any",
                "name": "event.exception.values",
                "inner": {
                    "op": "or",
                    "inner": [
                        {
                            "op": "and",
                            "inner": [
                                {"op": "glob", "name": "ty", "value": ["MyError"]},
                                {
                                    "op": "glob",
                                    "name": "value",
                                    "value": ["Something went wrong *"],
                                },
                            ],
                        },
                        {"op": "glob", "name": "value", "value": ["*known flaky test*"]},
                    ],
                },
            },
            {
                "op": "glob",
                "name": "event.logentry.formatted",
                "value": ["*known flaky test*"],
            },
        ],
    }


def test_custom_error_filter_exception_only_patterns_omit_logentry_branch() -> None:
    # Without any type-less pattern there is nothing that can match a message, so the
    # filter collapses back to the plain exception condition.
    with override_settings(
        SENTRY_INBOUND_FILTER_CUSTOM_VALUES=[("MyError", "Something went wrong *")]
    ):
        condition = _custom_error_filter()

    assert condition == {
        "op": "any",
        "name": "event.exception.values",
        "inner": {
            "op": "or",
            "inner": [
                {
                    "op": "and",
                    "inner": [
                        {"op": "glob", "name": "ty", "value": ["MyError"]},
                        {"op": "glob", "name": "value", "value": ["Something went wrong *"]},
                    ],
                },
            ],
        },
    }


def test_chunk_load_filter_unchanged_by_logentry_matching() -> None:
    # Built-in filters must not gain message matching: they keep the exception-only shape.
    condition = _chunk_load_error_filter()

    # An "any" top level (rather than the "or" wrapper) means there is no logentry branch.
    assert condition["op"] == "any"
    assert "event.logentry.formatted" not in repr(condition)


def test_error_message_condition_logentry_disabled_by_default() -> None:
    # The logentry branch is opt-in; the default keeps the historical exception-only shape.
    condition = _error_message_condition([(None, "*known flaky test*")])

    assert condition == {
        "op": "any",
        "name": "event.exception.values",
        "inner": {
            "op": "or",
            "inner": [{"op": "glob", "name": "value", "value": ["*known flaky test*"]}],
        },
    }


@django_db_all
def test_custom_error_filter_omitted_without_custom_values(default_project: Project) -> None:
    # The option is enabled by default for all projects, but with no configured custom
    # values the filter must not appear in the Relay config (no empty no-op condition).
    assert default_project.get_option("filters:custom-error") == "1"

    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=[]):
        generic_filters = get_generic_filters(default_project)

    # Other default filters keep the config non-empty; only custom-error is omitted.
    assert generic_filters is not None
    filter_ids = {f["id"] for f in generic_filters["filters"]}
    assert "custom-error" not in filter_ids


@django_db_all
def test_custom_error_filter_emitted_with_custom_values(default_project: Project) -> None:
    assert default_project.get_option("filters:custom-error") == "1"

    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=CUSTOM_PATTERNS):
        generic_filters = get_generic_filters(default_project)

    assert generic_filters is not None
    filter_ids = {f["id"] for f in generic_filters["filters"]}
    assert "custom-error" in filter_ids


@pytest.mark.parametrize(
    ("exc_type", "exc_message", "expected"),
    [
        ("MyError", "Something went wrong in checkout", True),
        ("MyError", "Unexpected failure", False),
        ("Error", "This is a known flaky test timeout", True),
        ("OtherError", "Something went wrong in checkout", False),
    ],
)
def test_custom_error_filter_matches_concrete_messages(
    exc_type: str, exc_message: str, expected: bool
) -> None:
    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=CUSTOM_PATTERNS):
        _custom_error_filter()

    assert exception_matches_filters(exc_type, exc_message, CUSTOM_PATTERNS) is expected


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        # Type-less pattern matches a plain message (capture_message) event.
        ("This is a known flaky test timeout", True),
        ("Something else entirely", False),
        # Patterns that carry an exception type cannot match a type-less message.
        ("Something went wrong in checkout", False),
    ],
)
def test_custom_error_filter_matches_concrete_messages_via_logentry(
    message: str, expected: bool
) -> None:
    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=CUSTOM_PATTERNS):
        _custom_error_filter()

    assert message_matches_filters(message, CUSTOM_PATTERNS) is expected
