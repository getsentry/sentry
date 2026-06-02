import pytest
from django.test import override_settings
from sentry_relay.processing import is_glob_match

from sentry.ingest.inbound_filters import _custom_error_filter

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


def test_custom_error_filter_empty() -> None:
    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=[]):
        condition = _custom_error_filter()

    assert condition == {
        "op": "any",
        "name": "event.exception.values",
        "inner": {"op": "or", "inner": []},
    }
    assert not exception_matches_filters("MyError", "Something went wrong in checkout", [])


def test_custom_error_filter_builds_one_rule_per_pattern() -> None:
    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=CUSTOM_PATTERNS):
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
                {"op": "glob", "name": "value", "value": ["*known flaky test*"]},
            ],
        },
    }


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
