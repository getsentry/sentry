"""Probability tails and robust-statistics constants, without scipy."""

import math
from collections.abc import Callable, Iterable, Iterator

# Scales a median absolute deviation to a normal standard deviation: 1 / Phi^-1(3/4).
MAD_TO_SIGMA = 1.4826
# Asymptotic standard error of a normal sample's median relative to its mean's.
MEDIAN_SE_FACTOR = math.sqrt(math.pi / 2)

# Relative change below which a series or continued fraction has converged.
_CONVERGENCE_TOLERANCE = 1e-14
# Smallest magnitude a Lentz denominator may take before it is nudged off zero.
_LENTZ_TINY = 1e-300

# beta_binomial_sf integrates instead of summing once both k and n - k + 1 reach this. Below
# it the sum is short, and the order statistic is too skewed for the trapezoid rule.
_MIN_QUADRATURE_COUNT = 1000
# Trapezoid grid over the order statistic, in its standard deviations: node spacing, and
# nodes on each side of its mean (+/- 16 sd).
_QUADRATURE_STEP_SDS = 0.5
_QUADRATURE_HALF_NODES = 32


def negative_binomial_sf(n: float, mean: float, size: float) -> float:
    """P(X >= n) for X ~ NegativeBinomial with the given mean and shape (size).

    pmf(x) = Gamma(x + size) / (Gamma(size) x!) * (1 - q)^size * q^x, q = mean / (size + mean).
    A non-integer n is rounded up; size is capped at 1e9, where the law is Poisson(mean).
    Computed as the regularized incomplete beta I_q(n, size), whose cost grows with
    sqrt(n + size) rather than with how far n sits from the mean.
    """
    k = math.ceil(n - 1e-9)
    if k <= 0:
        return 1.0
    if mean <= 0:
        return 0.0
    size = min(size, 1e9)
    return _regularized_beta(k, size, mean / (size + mean))


def beta_binomial_sf(successes: float, trials: float, a: float, b: float) -> float:
    """P(X >= successes) for X ~ BetaBinomial(n=trials, a, b).

    pmf(x) = C(n, x) B(x + a, n - x + b) / B(a, b): successes in n trials whose success rate
    is uncertain, distributed Beta(a, b). successes is rounded up and trials to nearest.
    Sums the pmf term by term, which takes on the order of the distribution's spread in
    steps. When that spread is wide (many trials against a weak prior, away from both ends),
    integrates over the order statistic instead; see _beta_binomial_sf_by_quadrature.
    """
    k, n = math.ceil(successes - 1e-9), round(trials)
    if k <= 0:
        return 1.0
    if k > n:
        return 0.0
    if min(k, n - k + 1) >= _MIN_QUADRATURE_COUNT and n >= 10 * (a + b):
        return _beta_binomial_sf_by_quadrature(k, n, a, b)
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
        upper = _sum_terms(
            log_pmf(k),
            range(k, n),
            lambda x: (n - x) / (x + 1) * (x + a) / (n - x - 1 + b),
        )
        return min(1.0, upper)
    lower = _sum_terms(
        log_pmf(k - 1),
        range(k - 1, 0, -1),
        lambda x: x / (n - x + 1) * (n - x + b) / (x - 1 + a),
    )
    return max(0.0, 1.0 - lower)


def _beta_binomial_sf_by_quadrature(k: int, n: int, a: float, b: float) -> float:
    """P(X >= k) for X ~ BetaBinomial(n, a, b), as E[P(p >= T)] over T ~ Beta(k, n - k + 1).

    Given the success rate p, X >= k exactly when the k-th smallest of n uniforms, T, is at
    most p. With n >= 10(a + b), T's density is much narrower than p's, so the trapezoid
    rule over it converges geometrically: within 1e-7 of the exact sum down to tails near
    1e-150. Past that, p's tail pulls the integrand's peak off T's mean and the grid starts
    to undercount, which no threshold on these probabilities can notice.
    """
    alpha, beta = k, n - k + 1
    log_norm = math.lgamma(alpha + beta) - math.lgamma(alpha) - math.lgamma(beta)
    mean = alpha / (alpha + beta)
    step = _QUADRATURE_STEP_SDS * math.sqrt(mean * (1 - mean) / (alpha + beta + 1))
    total = 0.0
    for i in range(-_QUADRATURE_HALF_NODES, _QUADRATURE_HALF_NODES + 1):
        t = mean + i * step
        if 0 < t < 1:
            log_density = log_norm + (alpha - 1) * math.log(t) + (beta - 1) * math.log1p(-t)
            total += math.exp(log_density) * _regularized_beta(b, a, 1 - t)  # P(p >= t).
    return min(1.0, total * step)


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
    if mean <= 0:
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
    max_terms = _max_terms(a)
    if x < a + 1:  # Series for P(a, x).
        ap, term = a, 1 / a
        total = term
        for _ in range(max_terms):
            ap += 1
            term *= x / ap
            total += term
            if abs(term) < abs(total) * _CONVERGENCE_TOLERANCE:
                break
        else:
            raise ArithmeticError(f"Gamma series did not converge for a={a}, x={x}")
        lower = total * lead
        return max(0.0, 1 - lower) if upper else min(1.0, lower)

    # Q(a, x) = lead / (x + 1 - a - 1(1 - a) / (x + 3 - a - 2(2 - a) / (x + 5 - a - ...))).
    fraction_terms = ((-i * (i - a) if i else 1.0, x + 1 - a + 2 * i) for i in range(max_terms))
    upper_tail = lead * _continued_fraction(fraction_terms)
    return upper_tail if upper else max(0.0, 1 - upper_tail)


def _regularized_beta(a: float, b: float, x: float) -> float:
    """I_x(a, b), the regularized incomplete beta, for a, b > 0 and 0 <= x <= 1.

    The continued fraction converges quickly for x < (a + 1) / (a + b + 2); past that, the
    symmetry I_x(a, b) = 1 - I_{1-x}(b, a) keeps it there, so only the larger side is taken
    as a complement.
    """
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lead = math.exp(
        math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log1p(-x)
    )
    if x < (a + 1) / (a + b + 2):
        return min(1.0, lead * _continued_fraction(_beta_fraction_terms(a, b, x)) / a)
    return max(0.0, 1 - lead * _continued_fraction(_beta_fraction_terms(b, a, 1 - x)) / b)


def _beta_fraction_terms(a: float, b: float, x: float) -> Iterator[tuple[float, float]]:
    """Partial numerators and denominators of I_x(a, b) * a / lead = 1 / (1 + d1 / (1 + ...)).

    d(2m) = m(b - m)x / ((a + 2m - 1)(a + 2m)) and
    d(2m + 1) = -(a + m)(a + b + m)x / ((a + 2m)(a + 2m + 1)).
    """
    yield 1.0, 1.0
    for m in range(_max_terms(max(a, b))):
        if m:
            yield m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m)), 1.0
        yield -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1)), 1.0


def _continued_fraction(terms: Iterable[tuple[float, float]]) -> float:
    """a1 / (b1 + a2 / (b2 + ...)) for (a_i, b_i) in terms, by the modified Lentz method.

    Raises ArithmeticError if the terms run out before the value converges.
    """
    value = c = _LENTZ_TINY
    d = 0.0
    for numerator, denominator in terms:
        d = denominator + numerator * d
        d = 1 / (d if abs(d) >= _LENTZ_TINY else _LENTZ_TINY)
        c = denominator + numerator / c
        c = c if abs(c) >= _LENTZ_TINY else _LENTZ_TINY
        delta = c * d
        value *= delta
        if abs(delta - 1) < _CONVERGENCE_TOLERANCE:
            return value
    raise ArithmeticError("Continued fraction did not converge")


def _max_terms(shape: float) -> int:
    """Iterations to allow a series or continued fraction whose largest shape is `shape`.

    Both need on the order of sqrt(shape) terms near the mode; this leaves a wide margin.
    """
    return 100 + int(20 * math.sqrt(shape))


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
