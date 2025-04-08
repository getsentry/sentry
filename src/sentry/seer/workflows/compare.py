from collections import defaultdict
from collections.abc import Mapping, Sequence

from sentry.seer.math import kl_divergence, laplace_smooth

Attributes = Mapping[str, dict[str, float]]
Distribution = dict[str, float]
KeyedValueCount = tuple[str, str, float]
Score = tuple[str, float]
ValueCount = tuple[str, float]


def keyed_kl_score(
    a: Sequence[KeyedValueCount],
    b: Sequence[KeyedValueCount],
    total_a: int,
    total_b: int,
) -> list[Score]:
    """
    KL score a multi-dimensional distribution of values. Returns a list of key, score pairs.
    Duplicates are not tolerated.

    Sample distribution:
        [("key", "true", 93), ("key", "false", 219), ("other", "true", 1)]
    """
    parsed_a = _as_attribute_dict(a)
    parsed_b = _as_attribute_dict(b)

    # Add unseen value for each field in the distribution. The unseen value is the total number of
    # events in the cohort less the sum of the distribution for that cohort. In other words, if the
    # distribution does not sum to the total number of events in the cohort it means that a
    # particular key was not always specified on the event. Omitted keys are valuable statistical
    # data and must be included in our calculations.
    #
    # The unseen value is stored on the key `""`.  If `""` is a valid value for your distribution
    # you will need to refactor this code path to choose a custom sentienel value.
    for dist in parsed_a.values():
        _add_unseen_value(dist, total_a)
    for dist in parsed_b.values():
        _add_unseen_value(dist, total_b)

    return _multi_dimensional_kl_compare_sets(parsed_a, parsed_b)


def kl_score(
    a: Sequence[ValueCount],
    b: Sequence[ValueCount],
    total_a: int,
    total_b: int,
) -> float:
    """
    KL score a mono-dimensional distribution of values. Duplicates are not tolerated.

    Sample distribution:
        [("true", 22), ("false", 94)]
    """
    dist_a = dict(a)
    dist_b = dict(b)

    # Add the unseen value for a.
    count_a = sum(map(lambda v: v[1], a))
    delta_a = total_a - count_a
    if delta_a > 0:
        dist_a[""] = delta_a

    # And for b.
    count_b = sum(map(lambda v: v[1], b))
    delta_b = total_b - count_b
    if delta_b > 0:
        dist_b[""] = delta_b

    return _kl_compare_sets(dist_a, dist_b)


def _as_attribute_dict(rows: Sequence[KeyedValueCount]) -> Attributes:
    """
    Coerce a database result into a standardized type.
    """
    attributes: Mapping[str, dict[str, float]] = defaultdict(dict[str, float])
    for key, value, count in rows:
        attributes[key][value] = count
    return attributes


def _add_unseen_value(dist: Distribution, total: int) -> None:
    count = sum(dist.values())
    delta = total - count
    if delta > 0:
        dist[""] = delta


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
