from sentry.seer.math import entropy, kl_divergence, laplace_smooth, rrf_score


def kl_compare_sets(sup: dict[str, float], sub: dict[str, float]):
    sup, sub = normalize_sets(sup, sub)
    return kl_divergence(list(sup.values()), list(sub.values()))


def rrf_compare_sets(sup: dict[str, float], sub: dict[str, float]):
    sup, sub = normalize_sets(sup, sub)
    kl_score = kl_divergence(list(sup.values()), list(sub.values()))
    entropy_score = entropy(list(sub.values()))
    return rrf_score(entropy_score, kl_score)


def normalize_sets(
    sup: dict[str, float],
    sub: dict[str, float],
) -> tuple[dict[str, float], dict[str, float]]:
    # add unseen value to each set.
    ...

    # Ensure the two datasets are symmetric. The baseline set should always be a superset of the
    # sub set.
    sub = _ensure_symmetry(sup, sub)

    # Laplace smooth each set.  This will give us a dictionary full of floating points which
    # sum to 1.
    sup = _smooth_distribution(sup)
    sub = _smooth_distribution(sub)

    return (sup, sub)


def _ensure_symmetry(sup: dict[str, float], sub: dict[str, float]) -> dict[str, float]:
    """
    Ensure the supersets keys are all contained within the subset. Extraneous keys in the subset
    are removed. Keys in the subset are implicitly reordered to match the superset.
    """
    return {k: sub.get(k, 0) for k in sup}


def _smooth_distribution(dist: dict[str, float]) -> dict[str, float]:
    return dict(zip(dist.keys(), laplace_smooth(dist.values())))
