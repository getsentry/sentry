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
