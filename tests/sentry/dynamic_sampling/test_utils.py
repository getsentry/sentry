import pytest

from sentry.dynamic_sampling.rules.utils import apply_dynamic_factor


@pytest.mark.parametrize(
    ["base_sample_rate", "x", "expected"],
    [
        (0.1, 2.0, 1.8660659830736148),
        (0.5, 3.0, 1.7320508075688774),
        (1.0, 4.0, 1.0),
    ],
)
def test_apply_dynamic_factor_with_valid_params(base_sample_rate, x, expected):
    assert apply_dynamic_factor(base_sample_rate, x) == pytest.approx(expected)


@pytest.mark.parametrize("base_sample_rate", [0.0, 1.1])
def test_apply_dynamic_factor_with_invalid_params(base_sample_rate):
    with pytest.raises(Exception):
        apply_dynamic_factor(base_sample_rate, 1)
