import pytest

from sentry.dynamic_sampling.sliding_window import extrapolate_monthly_volume
from sentry.testutils.helpers.datetime import freeze_time


@freeze_time("2023-02-03 12:00:00")
def test_extrapolate_monthly_volume_with_28_days() -> None:
    assert extrapolate_monthly_volume(volume=10, hours=24) == 280


@pytest.mark.parametrize(
    "volume, hours, expected_result",
    [
        (10, 48, 150),
        (10, 24, 300),
        (10, 12, 600),
        (10, 1, 7200),
    ],
)
@freeze_time("2023-04-03 12:00:00")
def test_extrapolate_monthly_volume_with_30_days(
    volume: int, hours: int, expected_result: int
) -> None:
    assert extrapolate_monthly_volume(volume=volume, hours=hours) == expected_result


@freeze_time("2023-05-03 12:00:00")
def test_extrapolate_monthly_volume_with_31_days() -> None:
    assert extrapolate_monthly_volume(volume=10, hours=24) == 310


def test_extrapolate_monthly_volume_rejects_a_window_below_one_hour() -> None:
    assert extrapolate_monthly_volume(volume=10, hours=0) is None
