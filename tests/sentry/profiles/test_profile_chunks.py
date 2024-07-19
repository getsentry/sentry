from datetime import UTC, datetime

import pytest
from snuba_sdk import Function

from sentry.profiles.profile_chunks import resolve_datetime64


@pytest.mark.parametrize(
    ["value", "expected"],
    [
        pytest.param(None, None, id="None"),
        pytest.param(
            1721339541.429418,
            Function("toDateTime64", [1721339541.429418, 6]),
            id="1721339541.429418",
        ),
        pytest.param(
            datetime(
                year=2024,
                month=7,
                day=18,
                hour=17,
                minute=55,
                second=27,
                microsecond=72215,
            ),
            Function("toDateTime64", ["2024-07-18T17:55:27.072215", 6]),
            id="2024-07-18T17:55:27.072215",
        ),
        pytest.param(
            datetime(
                year=2024,
                month=7,
                day=18,
                hour=17,
                minute=55,
                second=27,
                microsecond=72215,
                tzinfo=UTC,
            ),
            Function("toDateTime64", ["2024-07-18T17:55:27.072215", 6]),
            id="2024-07-18T17:55:27.072215 with timezone",
        ),
    ],
)
def test_resolve_datetime64(value, expected):
    assert resolve_datetime64(value) == expected
