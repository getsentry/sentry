from collections import defaultdict
from collections.abc import Mapping

from sentry.seer.math import kl_divergence, laplace_smooth

Attributes = Mapping[str, dict[str, float]]
Distribution = dict[str, float]
KeyedValueCount = tuple[str, str, float]
Score = tuple[str, float]
ValueCount = tuple[str, float]


def keyed_kl_score(a: list[KeyedValueCount], b: list[KeyedValueCount]) -> list[Score]:
    """
    KL score a multi-dimensional distribution of values. Returns a list of key, score pairs.
    Duplicates are not tolerated.

    Sample distribution:
        [("key", "true", 93), ("key", "false", 219), ("other", "true", 1)]
    """
    parsed_a = _as_attribute_dict(a)
    parsed_b = _as_attribute_dict(b)
    return _multi_dimensional_kl_compare_sets(parsed_a, parsed_b)


def kl_score(a: list[ValueCount], b: list[ValueCount]) -> float:
    """
    KL score a mono-dimensional distribution of values. Duplicates are not tolerated.

    Sample distribution:
        [("true", 22), ("false", 94)]
    """
    return _kl_compare_sets(dict(a), dict(b))


def _as_attribute_dict(rows: list[KeyedValueCount]) -> Attributes:
    """
    Coerce a database result into a standardized type.
    """
    attributes: Mapping[str, dict[str, float]] = defaultdict(dict[str, float])
    for key, value, count in rows:
        attributes[key][value] = count
    return attributes


def _multi_dimensional_kl_compare_sets(baseline: Attributes, outliers: Attributes) -> list[Score]:
    """
    Computes the KL scores of each key in the outlier set and returns a sorted list, in descending
    order, of key, score values.
    """
    return sorted(
        (
            (key, _kl_compare_sets(baseline[key], outliers[key]))
            for key in outliers
            if key in baseline
        ),
        key=lambda k: k[1],
        reverse=True,
    )


def _kl_compare_sets(a: Distribution, b: Distribution):
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
