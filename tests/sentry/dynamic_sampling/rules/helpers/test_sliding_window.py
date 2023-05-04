from freezegun import freeze_time

from sentry.dynamic_sampling.rules.helpers.sliding_window import extrapolate_monthly_volume


@freeze_time("2023-02-03 12:00:00")
def test_extrapolate_monthly_volume_with_28_days():
    result = extrapolate_monthly_volume(10)
    assert result == 280


@freeze_time("2023-04-03 12:00:00")
def test_extrapolate_monthly_volume_with_30_days():
    result = extrapolate_monthly_volume(10)
    assert result == 300


@freeze_time("2023-05-03 12:00:00")
def test_extrapolate_monthly_volume_with_31_days():
    result = extrapolate_monthly_volume(10)
    assert result == 310
