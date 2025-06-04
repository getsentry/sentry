import pytest

from sentry.incidents.utils.format_duration import format_duration_idiomatic

TEST_CASES = [
    (0, "0 minutes"),
    (1, "minute"),
    (5, "5 minutes"),
    (59, "59 minutes"),
    (60, "hour"),
    (61, "hour"),
    (115, "hour"),
    (120, "2 hours"),
    (121, "2 hours"),
    (1440, "day"),
    (1440 * 7, "week"),
    (1440 * 14, "2 weeks"),
    (1440 * 30, "month"),
    (1440 * 31, "month"),
]


@pytest.mark.parametrize("minutes, expected_str", TEST_CASES)
def test_format_duration(minutes, expected_str):
    assert expected_str == format_duration_idiomatic(minutes)
