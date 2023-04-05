import pytest

from sentry.dynamic_sampling.rules.utils import (
    actual_sample_rate,
    adjusted_factor,
    apply_dynamic_factor,
)


@pytest.mark.parametrize(
    ["base_sample_rate", "x", "expected"],
    [
        (0.0, 2.0, 2.0),
        (0.1, 2.0, 1.8660659830736148),
        (0.5, 3.0, 1.7320508075688774),
        (1.0, 4.0, 1.0),
    ],
)
def test_apply_dynamic_factor_with_valid_params(base_sample_rate, x, expected):
    assert apply_dynamic_factor(base_sample_rate, x) == pytest.approx(expected)


@pytest.mark.parametrize(["base_sample_rate", "x"], [(-0.1, 1.5), (1.1, 2.5), (0.5, 0)])
def test_apply_dynamic_factor_with_invalid_params(base_sample_rate, x):
    with pytest.raises(Exception):
        apply_dynamic_factor(base_sample_rate, x)


def test_actual_sample_rate_didnt_raise_exception():
    assert actual_sample_rate(0, 0) == 0.0


def test_actual_sample_rate():
    assert actual_sample_rate(count_keep=10, count_drop=10) == 0.5
    assert actual_sample_rate(count_keep=1, count_drop=0) == 1.0
    assert actual_sample_rate(count_keep=0, count_drop=1) == 0.0


@pytest.mark.parametrize(
    "prev_factor,actual_rate,desired_sample_rate,expected_adj_factor",
    [
        (1.0, 1.0, 1.0, 1.0),
        (1.0, 0.1, 0.036, 0.35999999999999993),  # emulate sentry
        (0.35999999999999993, 0.036, 0.036, 0.35999999999999993),  # emulate sentry
        (1.0, 0.25, 0.5, 2.0),
    ],
)
def test_adjusted_factor(prev_factor, actual_rate, desired_sample_rate, expected_adj_factor):
    assert adjusted_factor(prev_factor, actual_rate, desired_sample_rate) == expected_adj_factor
