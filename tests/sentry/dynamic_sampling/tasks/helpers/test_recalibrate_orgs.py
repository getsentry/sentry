import pytest

from sentry.dynamic_sampling.tasks.helpers.recalibrate_orgs import compute_adjusted_factor


@pytest.mark.parametrize(
    "prev_factor,actual_rate,desired_sample_rate,expected_adj_factor",
    [
        (1.0, 1.0, 1.0, 1.0),
        (1.0, 0.1, 0.036, 0.35999999999999993),  # emulate sentry
        (0.35999999999999993, 0.036, 0.036, 0.35999999999999993),  # emulate sentry
        (1.0, 0.25, 0.5, 2.0),
        (1.0, 0, 0.5, None),
        (0.0, 0.25, 0.5, None),
    ],
)
def test_adjusted_factor(prev_factor, actual_rate, desired_sample_rate, expected_adj_factor):
    assert (
        compute_adjusted_factor(prev_factor, actual_rate, desired_sample_rate)
        == expected_adj_factor
    )
