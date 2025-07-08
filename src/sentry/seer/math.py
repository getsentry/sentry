import math

from sentry.seer.vendored import entr, rel_entr


def laplace_smooth(probabilities: list[float], alpha: float = 1e-3) -> list[float]:
    """
    Removes 0 probabilities, preserves relative distribution of values, and normalizes range
    between 0 and 1.

    Equation:
        P(x) = (count(x) + a) / (N + a * |V|)

    Parameters:
        probabilities: A list of non-negative floating point values which sum to 1.
    """
    total = sum(probabilities)
    return [(value + alpha) / (total + alpha * len(probabilities)) for value in probabilities]


def entropy(xs: list[float]) -> float:
    """
    Shannon entropy. Quantifies the amount of uncertainty in a probability distribution.

    Equation:
        H = -sum(p(x) * log2(p(x)))

    Parameters:
        probabilities: A list of non-negative floating point values which sum to 1.
    """
    total = sum(xs)

    # Eagerly exit to prevent division by 0.
    if total == 0:
        return 0

    # `x` is normalized to be a proportion of 1. If total sums to 1 nothing changes. If the
    # values sum to less than or greater than 1 then the vector is normalized to represent a
    # probabiliity distribution (x / total).
    #
    # One quirk of this is that negative totals flip the sign of negative members. If you provide
    # an array full of negatives it will behave identically to an array of positives. This is how
    # scipy does it so we copy the behavior here.
    return sum(entr(x / total) for x in xs)


def relative_entropy(a: list[float], b: list[float]) -> list[float]:
    assert len(a) == len(b), "Mismatched distribution lengths"
    return [rel_entr(x, y) for (x, y) in zip(a, b) if a != 0]


def kl_divergence(a: list[float], b: list[float]) -> float:
    assert len(a) == len(b), "Mismatched distribution lengths"
    return sum(relative_entropy(a, b))


def rrf_score(
    entropy_scores: list[float],
    kl_scores: list[float],
    entropy_alpha: float = 0.2,
    kl_alpha: float = 0.8,
    offset: int = 60,
) -> list[float]:
    """
    Compute reciprocal rank fusion score.
    """

    def _rrf(kl_rank: int, entropy_rank: int) -> float:
        a = kl_alpha * (1 / (offset + kl_rank))
        b = entropy_alpha * (1 / (offset + entropy_rank))
        return a + b

    alphas = entropy_alpha + kl_alpha
    if not math.isclose(alphas, 1.0, rel_tol=1e-9):
        raise ValueError("Entropy alpha and KL alpha must sum to 1.")

    return [
        _rrf(kl_rank, e_rank)
        for kl_rank, e_rank in zip(
            rank_min(kl_scores, ascending=False),
            rank_min(entropy_scores, ascending=True),
        )
    ]


def rank_min(xs: list[float], ascending: bool = False):
    ranks = {x: rank for rank, x in enumerate(sorted(set(xs), reverse=not ascending), 1)}
    return [ranks[x] for x in xs]


def boxcox_transform(
    values: list[float], lambda_param: float | None = None
) -> tuple[list[float], float]:
    """
    Apply BoxCox transformation to a list of values.

    Parameters:
        values: List of positive values to transform
        lambda_param: BoxCox lambda parameter. If None, finds optimal lambda.

    Returns:
        Tuple of (transformed values, lambda parameter used)
    """
    min_value = min(values) if values else 0
    if min_value <= 0:
        shift_amount = -min_value + 1
        shifted_values = [v + shift_amount for v in values]
    else:
        shifted_values = values

    if lambda_param is not None:
        if lambda_param == 0.0:
            transformed = [math.log(max(v, 1e-10)) for v in shifted_values]
        else:
            transformed = [
                (pow(max(v, 1e-10), lambda_param) - 1) / lambda_param for v in shifted_values
            ]
        return transformed, lambda_param

    optimal_lambda = _boxcox_normmax(values)

    if optimal_lambda == 0.0:
        transformed = [math.log(max(v, 1e-10)) for v in shifted_values]
    else:
        transformed = [
            (pow(max(v, 1e-10), optimal_lambda) - 1) / optimal_lambda for v in shifted_values
        ]

    return transformed, optimal_lambda


def _boxcox_llf(lambda_param: float, values: list[float]) -> float:
    """
    Compute the Box-Cox log-likelihood function.

    Uses numerically stable log-space arithmetic following scipy's implementation.

    Parameters:
        lambda_param: BoxCox lambda parameter
        values: List of positive values

    Returns:
        Log-likelihood value
    """
    n = len(values)
    if n == 0:
        return 0.0

    log_values = [math.log(max(v, 1e-10)) for v in values]
    log_sum = sum(log_values)

    if lambda_param == 0.0:
        log_mean = log_sum / n
        log_var = sum((lv - log_mean) ** 2 for lv in log_values) / n
        logvar = math.log(max(log_var, 1e-10))
    else:
        # For λ≠0: Use log-space arithmetic for numerical stability
        # This avoids computing (x^λ - 1)/λ directly which can overflow
        # Uses identity: var((x^λ - 1)/λ) = var(x^λ)/λ²
        logx = [lambda_param * lv for lv in log_values]  # log(x^λ) = λ*log(x)
        logx_mean = sum(logx) / n
        logx_var = sum((lx - logx_mean) ** 2 for lx in logx) / n
        # log(var(y)) = log(var(x^λ)) - 2*log(|λ|)
        logvar = math.log(max(logx_var, 1e-10)) - 2 * math.log(abs(lambda_param))

    # Box-Cox log-likelihood: (λ-1)*Σlog(x) - n/2*log(var(y))
    return (lambda_param - 1) * log_sum - (n / 2) * logvar


def _boxcox_normmax(values: list[float], max_iters: int = 100) -> float:
    """
    Calculate the approximate optimal lambda parameter for BoxCox transformation that maximizes the log-likelihood.

    Uses MLE method with ternary search rather than Brent's method for efficient optimization.

    Parameters:
        values: List of positive values
        max_iters: Maximum number of iterations to run for ternary search

    Returns:
        Approximate optimal lambda parameter
    """
    if not values:
        return 0.0

    min_value = min(values)
    if min_value <= 0:
        values = [v - min_value + 1 for v in values]

    left = -2.0
    right = 2.0
    tolerance = 1e-6
    iters = 0

    while right - left > tolerance and iters < max_iters:
        m1 = left + (right - left) / 3
        m2 = right - (right - left) / 3

        llf_m1 = _boxcox_llf(m1, values)
        llf_m2 = _boxcox_llf(m2, values)

        if llf_m1 > llf_m2:
            right = m2
        else:
            left = m1

        iters += 1

    return (left + right) / 2


def calculate_z_scores(values: list[float]) -> list[float]:
    """
    Calculate z-scores for a list of values.

    Parameters:
        values: List of numerical values

    Returns:
        List of z-scores corresponding to input values
    """
    if not values:
        return []

    mean_val = sum(values) / len(values)
    variance = sum((x - mean_val) ** 2 for x in values) / len(values)
    std_dev = math.sqrt(variance)

    if std_dev == 0:
        return [0.0] * len(values)

    return [(x - mean_val) / std_dev for x in values]
