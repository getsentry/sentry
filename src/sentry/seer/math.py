import math


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

    # This is the scipy implementation. Copied from here:
    # https://github.com/scipy/scipy/blob/ce4b43097356dfc42504d81d6164b73ee0896c71/scipy/special/_convex_analysis.pxd#L8-L16
    def _entr(x: float) -> float:
        if math.isnan(x):
            return x
        elif x > 0:
            return -x * math.log(x)
        elif x == 0:
            return 0
        else:
            return -math.inf

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
    return sum(_entr(x / total) for x in xs)


def relative_entropy(a: list[float], b: list[float]) -> list[float]:
    def _rel_entr(x: float, y: float):
        if math.isnan(x) or math.isnan(y):
            return math.nan
        elif x > 0 and y > 0:
            return x * math.log(x / y)
        elif x == 0 and y >= 0:
            return 0
        else:
            return math.inf

    assert len(a) == len(b), "Mismatched distribution lengths"
    return [_rel_entr(x, y) for (x, y) in zip(a, b) if a != 0]


def kl_divergence(a: list[float], b: list[float]) -> float:
    assert len(a) == len(b), "Mismatched distribution lengths"
    return sum(relative_entropy(a, b))
