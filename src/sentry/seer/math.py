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
