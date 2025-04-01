from sentry.seer.math import kl_divergence, laplace_smooth

Distribution = dict[str, float]


def kl_compare_sets(a: Distribution, b: Distribution):
    a, b = _normalize_sets(a, b)
    return kl_divergence(list(a.values()), list(b.values()))


def _normalize_sets(a: Distribution, b: Distribution) -> tuple[Distribution, Distribution]:
    # add unseen value to each set.
    ...

    # Ensure the two datasets are symmetric.
    a, b = _ensure_symmetry(a, b)

    # Laplace smooth each set.  This will give us a dictionary full of floating points which
    # sum to 1.
    a = _smooth_distribution(a)
    b = _smooth_distribution(b)

    return (a, b)


def _ensure_symmetry(a: Distribution, b: Distribution) -> tuple[Distribution, Distribution]:
    """
    Ensure the supersets keys are all contained within the subset. Extraneous keys in the subset
    are removed. Keys in the subset are implicitly reordered to match the superset.
    """
    keys = a.keys() | b.keys()
    a = {k: a.get(k, 0) for k in keys}
    b = {k: b.get(k, 0) for k in keys}
    return a, b


def _smooth_distribution(dist: Distribution) -> Distribution:
    return dict(zip(dist.keys(), laplace_smooth(list(dist.values()))))
