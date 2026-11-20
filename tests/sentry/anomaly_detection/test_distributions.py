import math
from fractions import Fraction

import pytest

from sentry.anomaly_detection.evaluation.distributions import (
    beta_binomial_sf,
    gamma_sf,
    negative_binomial_sf,
    poisson_sf,
)

# Reference tails below were computed once with mpmath 1.4.1 at 60 significant digits:
#   negative binomial: betainc(k, size, 0, mean / (size + mean), regularized=True)
#   beta-binomial:     sum(binomial(n, x) * beta(x + a, n - x + b) / beta(a, b) for x >= k)
#   gamma:             gammainc(a, x, inf, regularized=True)
#   Poisson:           gammainc(k, 0, mean, regularized=True)
# with k = ceil(n) and n = round(trials), mirroring the implementations' rounding.


@pytest.mark.parametrize(
    ("n", "mean", "size", "expected"),
    [
        (5, 1.0, 2.0, 0.01783264746227709),
        (0.5, 1.0, 2.0, 0.5555555555555556),  # Non-integer n rounds up to 1.
        (2.5, 3.0, 1.5, 0.45472474576535343),  # Non-integer size.
        (3, 10.0, 1.0, 0.7513148009015778),  # Below the mean.
        (8, 10.0, 4.0, 0.6114236705086631),
        (50, 10.0, 4.0, 3.135077623245156e-05),
        (60, 5.0, 0.7, 0.00015769488904760225),
        (401, 50.5, 2.0, 2.802300623611957e-06),
        (420, 180.5, 40.0, 3.84606962826492e-09),
    ],
)
def test_negative_binomial_sf(n: float, mean: float, size: float, expected: float) -> None:
    assert negative_binomial_sf(n, mean, size) == pytest.approx(expected, rel=1e-9)


def test_negative_binomial_sf_caps_size_near_poisson() -> None:
    # Reference uses the capped size 1e9. lgamma(x + size) - lgamma(size) cancels about
    # ten digits at that size, so only a looser tolerance is meaningful.
    assert negative_binomial_sf(40, 5.0, 1e12) == pytest.approx(8.550028864147146e-23, rel=1e-5)


@pytest.mark.parametrize(
    ("n", "mean", "size", "expected"),
    [(0, 5.0, 2.0, 1.0), (-3, 5.0, 2.0, 1.0), (1e-10, 5.0, 2.0, 1.0), (1, 0.0, 2.0, 0.0)],
)
def test_negative_binomial_sf_edges(n: float, mean: float, size: float, expected: float) -> None:
    assert negative_binomial_sf(n, mean, size) == expected


@pytest.mark.parametrize(
    ("successes", "trials", "a", "b", "expected"),
    [
        (5, 100, 2.5, 40.5, 0.5497457659670978),  # Below the mean.
        (4.2, 99.6, 2.5, 40.5, 0.5497457659670978),  # Rounds to 5 of 100.
        (1, 300, 0.5, 0.5, 0.9674400686650203),
        (250, 300, 0.5, 0.5, 0.269611858192491),
        (10, 10, 0.5, 0.5, 0.17619705200195312),
        (40, 3000, 3.5, 997.5, 0.001225883493069661),
        (60, 1000, 1.5, 300.0, 4.135067850130039e-07),
        (30, 2000, 2.0, 2000.0, 1.335172783575249e-08),
    ],
)
def test_beta_binomial_sf(
    successes: float, trials: float, a: float, b: float, expected: float
) -> None:
    assert beta_binomial_sf(successes, trials, a, b) == pytest.approx(expected, rel=1e-9)


@pytest.mark.parametrize(
    ("successes", "trials", "expected"), [(0, 10, 1.0), (-1, 10, 1.0), (11, 10, 0.0)]
)
def test_beta_binomial_sf_edges(successes: float, trials: float, expected: float) -> None:
    assert beta_binomial_sf(successes, trials, 0.5, 0.5) == expected


@pytest.mark.parametrize(
    ("a", "x", "expected"),
    [
        (0.3, 0.1, 0.4540871504082035),  # Series branch, shape below one.
        (0.3, 5.0, 0.0006513187507184515),
        (0.5, 20.0, 2.539628589470865e-10),
        (2.5, 1.0, 0.8491450360846097),
        (2.5, 4.0, 0.15623562757772233),
        (3, 0.5, 0.9856123220330293),
        (50, 40.0, 0.9296649333406051),
        (50, 80.0, 0.00013078397659141034),
        (10, 40.0, 3.925932226286188e-09),
        (1, 25.0, 1.3887943864964021e-11),
    ],
)
def test_gamma_sf(a: float, x: float, expected: float) -> None:
    assert gamma_sf(a, x) == pytest.approx(expected, rel=1e-9)


@pytest.mark.parametrize(("a", "x"), [(0.3, 0.0), (5, -1.0)])
def test_gamma_sf_edges(a: float, x: float) -> None:
    assert gamma_sf(a, x) == 1.0


@pytest.mark.parametrize(
    ("a", "x"),
    [
        (1, 0.5),
        (1, 1.9),
        (3, 0.5),
        (3, 3.9),
        (50, 40.0),
        (50, 49.0),
        (1, 3.0),
        (3, 6.0),
        (50, 60.0),
    ],
)
def test_gamma_sf_matches_integer_shape_closed_form(a: int, x: float) -> None:
    # For integer shape, Q(a, x) = e^-x * sum_{k<a} x^k / k!.
    exact = math.exp(-x) * math.fsum(x**k / math.factorial(k) for k in range(a))
    assert gamma_sf(a, x) == pytest.approx(exact, rel=1e-11)


@pytest.mark.parametrize(
    ("k", "mean", "expected"),
    [
        (1, 0.5, 0.3934693402873666),
        (3, 10.0, 0.9972306042844884),  # Below the mean.
        (10, 10.0, 0.5420702855281478),
        (80, 100.0, 0.9825486774837245),
        (12, 2.0, 1.3646151596151952e-06),
        (150, 100.0, 1.88421046603867e-06),
        (20, 3.0, 8.3144235881917e-11),
        # 1 - P(X < k) would round to zero here.
        (7, 0.01, 1.96684280255335e-18),
    ],
)
def test_poisson_sf(k: int, mean: float, expected: float) -> None:
    assert poisson_sf(k, mean) == pytest.approx(expected, rel=1e-9)


@pytest.mark.parametrize(
    ("k", "mean", "expected"), [(0, 3.0, 1.0), (-2, 3.0, 1.0), (0, 0.0, 1.0), (4, 0.0, 0.0)]
)
def test_poisson_sf_edges(k: int, mean: float, expected: float) -> None:
    assert poisson_sf(k, mean) == expected


def _nb_sf_exact(k: int, mean: Fraction, size: int) -> float:
    q = mean / (size + mean)
    term, cdf = (1 - q) ** size, Fraction(0)
    for x in range(k):
        cdf += term
        term = term * (x + size) / (x + 1) * q
    return float(1 - cdf)


def _betabinom_sf_exact(k: int, n: int, a: Fraction, b: Fraction) -> float:
    term, cdf = Fraction(1), Fraction(0)
    for i in range(n):
        term = term * (b + i) / (a + b + i)
    for x in range(k):
        cdf += term
        term = term * Fraction(n - x, x + 1) * (x + a) / (n - x - 1 + b)
    return float(1 - cdf)


def test_negative_binomial_tail_is_exact_and_monotone_past_400() -> None:
    mean = Fraction(101, 2)
    tails = [negative_binomial_sf(k, float(mean), 2) for k in range(399, 403)]
    assert tails == sorted(tails, reverse=True)
    for k, tail in zip(range(399, 403), tails):
        assert tail == pytest.approx(_nb_sf_exact(k, mean, 2), rel=1e-9)


@pytest.mark.parametrize(
    ("k", "mean", "size"),
    [(5, Fraction(1), 2), (420, Fraction(361, 2), 40), (3, Fraction(10), 1), (40, Fraction(10), 1)],
)
def test_negative_binomial_tail_matches_exact_sum(k: int, mean: Fraction, size: int) -> None:
    assert negative_binomial_sf(k, float(mean), size) == pytest.approx(
        _nb_sf_exact(k, mean, size), rel=1e-9
    )


def test_beta_binomial_tail_is_exact_and_continuous_past_3000_trials() -> None:
    a, b = Fraction(7, 2), Fraction(1995, 2)
    tails = [beta_binomial_sf(40, n, float(a), float(b)) for n in (3000, 3001)]
    for n, tail in zip((3000, 3001), tails):
        assert tail == pytest.approx(_betabinom_sf_exact(40, n, a, b), rel=1e-9)
    assert tails[1] == pytest.approx(tails[0], rel=0.01)


@pytest.mark.parametrize(
    ("k", "n", "a", "b"),
    [
        (5, 100, Fraction(5, 2), Fraction(81, 2)),
        (1, 300, Fraction(1, 2), Fraction(1, 2)),
        (250, 300, Fraction(1, 2), Fraction(1, 2)),
        (10, 10, Fraction(1, 2), Fraction(1, 2)),
    ],
)
def test_beta_binomial_tail_matches_exact_sum(k: int, n: int, a: Fraction, b: Fraction) -> None:
    assert beta_binomial_sf(k, n, float(a), float(b)) == pytest.approx(
        _betabinom_sf_exact(k, n, a, b), rel=1e-9
    )
