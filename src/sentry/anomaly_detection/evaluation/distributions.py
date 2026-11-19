"""Probability tails and robust-statistics constants, without scipy."""

import itertools
import math
from collections.abc import Callable, Iterable

# Scales a median absolute deviation to a normal standard deviation: 1 / Phi^-1(3/4).
MAD_TO_SIGMA = 1.4826
# Asymptotic standard error of a normal sample's median relative to its mean's.
MEDIAN_SE_FACTOR = math.sqrt(math.pi / 2)


def negative_binomial_sf(n: float, mean: float, size: float) -> float:
    """P(X >= n) for X ~ NegativeBinomial with the given mean and shape (size).

    pmf(x) = Gamma(x + size) / (Gamma(size) x!) * (1 - q)^size * q^x, q = mean / (size + mean).
    A non-integer n is rounded up; size is capped at 1e9, where the law is Poisson(mean).
    """
    k = math.ceil(n - 1e-9)
    if k <= 0:
        return 1.0
    if mean <= 0:
        return 0.0
    size = min(size, 1e9)
    q = mean / (size + mean)

    def log_pmf(x: int) -> float:
        return (
            math.lgamma(x + size)
            - math.lgamma(size)
            - math.lgamma(x + 1)
            + size * math.log1p(-q)
            + x * math.log(q)
        )

    # Sum away from the mean, so the terms shrink until they stop mattering.
    if k > mean:
        return min(
            1.0,
            _sum_terms(log_pmf(k), itertools.count(k), lambda x: (x + size) / (x + 1) * q),
        )
    lower = _sum_terms(log_pmf(k - 1), range(k - 1, 0, -1), lambda x: x / ((x - 1 + size) * q))
    return max(0.0, 1.0 - lower)


def beta_binomial_sf(successes: float, trials: float, a: float, b: float) -> float:
    """P(X >= successes) for X ~ BetaBinomial(n=trials, a, b).

    pmf(x) = C(n, x) B(x + a, n - x + b) / B(a, b): successes in n trials whose success rate
    is uncertain, distributed Beta(a, b). successes is rounded up and trials to nearest.
    """
    k, n = math.ceil(successes - 1e-9), round(trials)
    if k <= 0:
        return 1.0
    if k > n:
        return 0.0
    lg = math.lgamma

    def log_pmf(x: int) -> float:
        return (
            lg(n + 1)
            - lg(x + 1)
            - lg(n - x + 1)
            + lg(x + a)
            + lg(n - x + b)
            - lg(n + a + b)
            - (lg(a) + lg(b) - lg(a + b))
        )

    # Sum away from the mean, so the terms shrink until they stop mattering.
    if k > n * a / (a + b):
        return min(
            1.0,
            _sum_terms(
                log_pmf(k),
                range(k, n),
                lambda x: (n - x) / (x + 1) * (x + a) / (n - x - 1 + b),
            ),
        )
    lower = _sum_terms(
        log_pmf(k - 1),
        range(k - 1, 0, -1),
        lambda x: x / (n - x + 1) * (n - x + b) / (x - 1 + a),
    )
    return max(0.0, 1.0 - lower)


def gamma_sf(a: float, x: float) -> float:
    """Regularized upper incomplete gamma Q(a, x) = Gamma(a, x) / Gamma(a) = P(Gamma(a, 1) >= x)."""
    return _regularized_gamma(a, x, upper=True)


def poisson_sf(k: int, mean: float) -> float:
    """P(X >= k) for X ~ Poisson(mean).

    Equals the regularized lower incomplete gamma P(k, mean), which avoids the cancellation of
    1 - sum_{j<k} pmf(j) in the far tail.
    """
    if k <= 0:
        return 1.0
    if not mean:
        return 0.0
    return _regularized_gamma(k, mean, upper=False)


def _regularized_gamma(a: float, x: float, *, upper: bool) -> float:
    """Q(a, x) if upper else P(a, x) = 1 - Q(a, x), for a > 0.

    The series converges for x < a + 1 and yields P; the continued fraction otherwise yields
    Q. Only the requested side that is not computed directly is taken as a complement.
    """
    if x <= 0:
        return 1.0 if upper else 0.0
    lead = math.exp(-x + a * math.log(x) - math.lgamma(a))
    if x < a + 1:  # Series for P(a, x).
        ap, term = a, 1 / a
        total = term
        for _ in range(500):
            ap += 1
            term *= x / ap
            total += term
            if abs(term) < abs(total) * 1e-12:
                break
        lower = total * lead
        return max(0.0, 1 - lower) if upper else min(1.0, lower)

    tiny = 1e-300  # Continued fraction for Q(a, x), using the modified Lentz method.
    b = x + 1 - a
    c, d = 1 / tiny, 1 / b
    h = d
    for i in range(1, 500):
        an = -i * (i - a)
        b += 2
        d = an * d + b
        d = tiny if abs(d) < tiny else d
        c = b + an / c
        c = tiny if abs(c) < tiny else c
        d = 1 / d
        h *= d * c
        if abs(d * c - 1) < 1e-12:
            break
    upper_tail = lead * h
    return upper_tail if upper else max(0.0, 1 - upper_tail)


def _sum_terms(log_first: float, steps: Iterable[int], ratio: Callable[[int], float]) -> float:
    """Sum probability terms from exp(log_first), multiplying by ratio(x) at each step x.

    Stops once a term underflows or no longer changes the total.
    """
    term = total = math.exp(log_first)
    for x in steps:
        term *= ratio(x)
        total += term
        if term <= total * 1e-17:
            break
    return total
