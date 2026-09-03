import pytest

from sentry.dynamic_sampling.tasks.constants import (
    MAX_REBALANCE_FACTOR,
    MIN_REBALANCE_FACTOR,
    bounded_rebalance_factor,
)
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
@pytest.mark.parametrize(
    "factor,expected",
    [
        (1.5, 1.5),
        (MIN_REBALANCE_FACTOR, MIN_REBALANCE_FACTOR),
        (MAX_REBALANCE_FACTOR, MAX_REBALANCE_FACTOR),
        (MIN_REBALANCE_FACTOR / 2, None),
        (MAX_REBALANCE_FACTOR * 2, None),
    ],
)
def test_an_out_of_bounds_factor_is_discarded_by_default(
    factor: float, expected: float | None
) -> None:
    assert bounded_rebalance_factor(factor) == expected


@django_db_all
@override_options({"dynamic-sampling.recalibration.clamp-factor": True})
@pytest.mark.parametrize(
    "factor,expected",
    [
        (1.5, 1.5),
        (MIN_REBALANCE_FACTOR / 2, MIN_REBALANCE_FACTOR),
        (MAX_REBALANCE_FACTOR * 2, MAX_REBALANCE_FACTOR),
    ],
)
def test_an_out_of_bounds_factor_is_clamped_when_the_option_is_on(
    factor: float, expected: float
) -> None:
    assert bounded_rebalance_factor(factor) == expected
