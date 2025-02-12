import re

import pytest

from sentry.snuba.metrics.naming_layer.mri import ParsedMRI, is_custom_measurement, parse_mri
from sentry.snuba.metrics.naming_layer.public import PUBLIC_NAME_REGEX


@pytest.mark.parametrize(
    "name",
    [
        "session.duration",
        "session.all",
        "session.abnormal",
        "session.crashed",
        "session.crash_free_user_rate" "foo.bar.bar",
        "foo_bar.bar",
    ],
)
def test_valid_public_name_regex(name):
    matches = re.compile(rf"^{PUBLIC_NAME_REGEX}$").match(name)
    assert matches
    assert matches[0] == name


@pytest.mark.parametrize(
    "name",
    [
        "session.",
        ".session",
        "session..crashed",
        "..crashed",
        "e:sessions/error.preaggr@none",
        "e:sessions/crashed_abnormal@none",
        "e:sessions/user.crashed_abnormal@none",
        "session.09_crashed",
    ],
)
def test_invalid_public_name_regex(name):
    assert re.compile(rf"^{PUBLIC_NAME_REGEX}$").match(name) is None


@pytest.mark.parametrize(
    "name, expected",
    [
        (
            "d:transactions/measurements.stall_longest_time@millisecond",
            ParsedMRI("d", "transactions", "measurements.stall_longest_time", "millisecond"),
        ),
        (
            "d:transactions/breakdowns.span_ops.ops.http@millisecond",
            ParsedMRI("d", "transactions", "breakdowns.span_ops.ops.http", "millisecond"),
        ),
        (
            "c:transactions/measurements.db_calls@none",
            ParsedMRI("c", "transactions", "measurements.db_calls", "none"),
        ),
        (
            "s:sessions/error@none",
            ParsedMRI("s", "sessions", "error", "none"),
        ),
        (
            "dist:my_namespace/organizations/v1/my endpoint@{none}",
            ParsedMRI("dist", "my_namespace", "organizations/v1/my endpoint", "{none}"),
        ),
        (
            "d:transactions/measurements.disk_io@byte/second",
            ParsedMRI("d", "transactions", "measurements.disk_io", "byte/second"),
        ),
    ],
)
def test_parse_mri_with_valid_mri(name, expected):
    parsed_mri = parse_mri(name)
    assert parsed_mri == expected
    assert parsed_mri.mri_string == name


@pytest.mark.parametrize(
    "name",
    [
        "d@transactions/measurements.stall_longest_time",
        "d:transactions/breakdowns.span_ops.ops.http",
        "d/transactions@breakdowns.span_ops.ops.http:millisecond",
        "d/transactions",
        "transactions",
        ":transactions/breakdowns.span_ops.ops.http@none",
        ":/@",
    ],
)
def test_parse_mri_with_invalid_mri(name):
    parsed_mri = parse_mri(name)
    assert parsed_mri is None


@pytest.mark.parametrize(
    "parsed_mri, expected",
    [
        (
            ParsedMRI("d", "transactions", "measurements.stall_longest_time", "millisecond"),
            False,
        ),
        (
            ParsedMRI("d", "transactions", "breakdowns.span_ops.ops.http", "millisecond"),
            False,
        ),
        (
            ParsedMRI("c", "transactions", "measurements.db_calls", "none"),
            True,
        ),
        (
            ParsedMRI("s", "sessions", "error", "none"),
            False,
        ),
    ],
)
def test_is_custom_measurement(parsed_mri, expected):
    assert is_custom_measurement(parsed_mri) == expected
