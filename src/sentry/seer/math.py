import math


def entropy(probabilities: list[float], base=math.e) -> float:
    """
    Shannon entropy. Quantifies the amount of uncertainty in a probability distribution.

    Equation:
        H = -sum(p(x) * log2(p(x)))

    Parameters:
        probabilities: A list of non-negative floating point values which sum to 1.
    """
    if len(probabilities) == 0:
        return 0.0

    # Negative probabilities are not allowed.
    if any(s < 0 for s in probabilities):
        return -math.inf

    total = sum(probabilities)

    # If the sum of the probabilities is 0 we return nan to emulate scipy's behavior.
    if total == 0:
        return math.nan

    # If the sum of the probabilities does not equal to 1 then we can not perform the shannon
    # entropy function. However we can normalize the values to the ratio of the sum which is what
    # scipy appears to do. This ensures the probabilities always add up to 1 with each probability
    # maintaining its relative dimension.
    #
    # We check for reasonable proximity to 1 with the offset 1e-9. Floating point numbers might not
    # add up to 1 but may be close enough to not matter. If we were to ratio every probability that
    # didn't end up as 1 we would introduce additional amounts of floating point loss.
    if not math.isclose(total, 1.0, rel_tol=1e-9):
        probabilities = [n / total for n in probabilities]

    return -sum(n * math.log(n, base) for n in probabilities if n > 0)


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


def relative_entropy(a: list[float], b: list[float]) -> list[float]:
    assert len(a) == len(b), "Mismatched distribution lengths"
    return [x * math.log(x / y) for (x, y) in zip(a, b) if a != 0]


def kl_divergence(a: list[float], b: list[float]) -> float:
    assert len(a) == len(b), "Mismatched distribution lengths"
    return sum(relative_entropy(a, b))


def rrf_score(
    entropy_score: float,
    kl_score: float,
    entropy_alpha: float = 0.2,
    kl_alpha: float = 0.8,
    offset: int = 60,
) -> float:
    """Compute reciprocal rank fusion score."""
    a = kl_alpha * (1 / (offset + kl_score))
    b = (1 - entropy_alpha) * (1 / (offset + entropy_score))
    return a + b


def _ranked(probabilities: list[float], reverse=False) -> list[float]:
    ranked = sorted(enumerate(probabilities), key=lambda k: k[1], reverse=reverse)
    ranks = [0] * len(ranked)

    i = 0
    while i < len(ranked):
        j = i
        while j < len(ranked) and ranked[i][1] == ranked[j][1]:
            j += 1
        for k in range(i, j):
            ranks[ranked[k][0]] = i + 1
        i = j
    return ranks


def max_ranked(probabilities: list[float]) -> list[float]:
    return _ranked(probabilities, reverse=True)


def min_ranked(probabilities: list[float]) -> list[float]:
    return _ranked(probabilities, reverse=False)
