import pytest
from freezegun import freeze_time

from sentry.dynamic_sampling.rules.helpers.sliding_window import extrapolate_monthly_volume


@freeze_time("2023-02-03 12:00:00")
def test_extrapolate_monthly_volume_with_28_days():
    result = extrapolate_monthly_volume(volume=10, hours=24)
    assert result == 280


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
def test_extrapolate_monthly_volume_with_30_days(volume, hours, expected_result):
    result = extrapolate_monthly_volume(volume=volume, hours=hours)
    assert result == expected_result


@freeze_time("2023-05-03 12:00:00")
def test_extrapolate_monthly_volume_with_31_days():
    result = extrapolate_monthly_volume(volume=10, hours=24)
    assert result == 310
