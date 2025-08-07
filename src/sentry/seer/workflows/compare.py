from collections import defaultdict
from collections.abc import Callable, Generator, Mapping, Sequence
from typing import TypeVar

from sentry.seer.math import (
    boxcox_transform,
    calculate_z_scores,
    entropy,
    kl_divergence,
    laplace_smooth,
    rrf_score,
)

T = TypeVar("T")

Attributes = Mapping[str, dict[str, float]]
Distribution = dict[str, float]
KeyedValueCount = tuple[str, str, float]
ValueCount = tuple[str, float]
Score = tuple[str, float]


def keyed_kl_score(
    baseline: Sequence[KeyedValueCount],
    outliers: Sequence[KeyedValueCount],
    total_baseline: int,
    total_outliers: int,
) -> list[tuple[str, float]]:
    """
    KL score a multi-dimensional distribution of values. Returns a list of key, score pairs.
    Duplicates are not tolerated.

    Sample distribution:
        [("key", "true", 93), ("key", "false", 219), ("other", "true", 1)]
    """
    return sorted(
        _score_each_key(
            baseline,
            outliers,
            total_baseline,
            total_outliers,
            scoring_fn=kl_divergence,
        ),
        key=lambda k: k[1],
        reverse=True,
    )


def keyed_rrf_score(
    baseline: Sequence[KeyedValueCount],
    outliers: Sequence[KeyedValueCount],
    total_baseline: int,
    total_outliers: int,
    entropy_alpha: float = 0.2,
    kl_alpha: float = 0.8,
    offset: int = 60,
) -> list[tuple[str, float]]:
    """
    RRF score a multi-dimensional distribution of values. Returns a list of key, score pairs.
    Duplicates are not tolerated.

    Sample distribution:
        [("key", "true", 93), ("key", "false", 219), ("other", "true", 1)]
    """

    def _scoring_fn(baseline: list[float], outliers: list[float]):
        return (entropy(outliers), kl_divergence(baseline, outliers))

    scored_keys = _score_each_key(
        baseline,
        outliers,
        total_baseline,
        total_outliers,
        scoring_fn=_scoring_fn,
    )

    keys = []
    entropy_scores = []
    kl_scores = []

    for key, (entropy_score, kl_score) in scored_keys:
        keys.append(key)
        entropy_scores.append(entropy_score)
        kl_scores.append(kl_score)

    return sorted(
        zip(keys, rrf_score(entropy_scores, kl_scores, entropy_alpha, kl_alpha, offset)),
        key=lambda k: k[1],
        reverse=True,
    )


def _score_each_key(
    baseline: Sequence[KeyedValueCount],
    outliers: Sequence[KeyedValueCount],
    total_baseline: int,
    total_outliers: int,
    scoring_fn: Callable[[list[float], list[float]], T],
) -> Generator[tuple[str, T]]:
    """
    Return a list of key, score pairs where each key is assigned a score according to the
    scoring_fn.

    Sample input:
        [("key", "true", 93), ("key", "false", 219), ("other", "true", 1)]
    """
    for key, (a, b) in _gen_normalized_distributions(
        baseline,
        outliers,
        total_baseline,
        total_outliers,
    ):
        yield (
            key,
            scoring_fn(
                list(a.values()),
                list(b.values()),
            ),
        )


def _gen_normalized_distributions(
    baseline: Sequence[KeyedValueCount],
    outliers: Sequence[KeyedValueCount],
    total_baseline: int,
    total_outliers: int,
) -> Generator[tuple[str, tuple[Distribution, Distribution]]]:
    """
    Generate normalized, keyed distributions where baseline and selection sets for the same key
    are paired.

    Sample input:
        [("key", "true", 93), ("key", "false", 219), ("other", "true", 1)]
    """
    keyed_baseline = _as_attribute_dict(baseline)
    keyed_outliers = _as_attribute_dict(outliers)

    for key in keyed_outliers:
        if key in keyed_baseline:
            baseline_dist = keyed_baseline[key]
            outliers_dist = keyed_outliers[key]

            # Add unseen value for each field in the distribution. The unseen value is the total
            # number of events in the cohort less the sum of the distribution for that cohort. In
            # other words, if the distribution does not sum to the total number of events in the
            # cohort it means that a particular key was not always specified on the event. Omitted
            # keys are valuable statistical data and must be included in our calculations.
            #
            # The unseen value is stored on the key `""`.  If `""` is a valid value for your
            # distribution you will need to refactor this code path to choose a custom sentienel
            # value.
            _add_unseen_value(baseline_dist, total_baseline)
            _add_unseen_value(outliers_dist, total_outliers)

            # The two sets should be symmetric so we are comparing like for like values.
            baseline_dist, outliers_dist = _ensure_symmetry(baseline_dist, outliers_dist)

            # Laplace smooth the distributions.
            baseline_dist = _smooth_distribution(baseline_dist)
            outliers_dist = _smooth_distribution(outliers_dist)

            # Ensure the two distributions are symmetric (i.e. have the same keys).
            yield (key, (baseline_dist, outliers_dist))


def _add_unseen_value(dist: Distribution, total: int) -> None:
    count = sum(dist.values())
    delta = total - count
    if delta > 0:
        dist[""] = delta


def _as_attribute_dict(rows: Sequence[KeyedValueCount]) -> Attributes:
    """
    Coerce a database result into a standardized type.
    """
    attributes: Mapping[str, dict[str, float]] = defaultdict(dict[str, float])
    for key, value, count in rows:
        attributes[key][value] = count
    return attributes


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


def keyed_rrf_score_with_filter(
    baseline: Sequence[KeyedValueCount],
    outliers: Sequence[KeyedValueCount],
    total_baseline: int,
    total_outliers: int,
    entropy_alpha: float = 0.2,
    kl_alpha: float = 0.8,
    offset: int = 60,
    z_threshold: float = 1.5,
) -> list[tuple[str, float, bool]]:
    """
    RRF score a multi-dimensional distribution of values. Returns a list of key, score pairs, and a mapping of if the key was filtered.
    The filtered keys are those that have a normalized entropy and kl score less than the z_threshold.
    Duplicates are not tolerated.

    Sample distribution:
        [("key", "true", 93), ("key", "false", 219), ("other", "true", 1)]

    Sample output:
        [("key", 0.5, True), ("key", 0.3, False), ("other", 0.1, False)]
    """

    def _scoring_fn(baseline: list[float], outliers: list[float]):
        return (entropy(outliers), kl_divergence(baseline, outliers))

    scored_keys = _score_each_key(
        baseline,
        outliers,
        total_baseline,
        total_outliers,
        scoring_fn=_scoring_fn,
    )

    keys = []
    entropy_scores = []
    kl_scores = []

    for key, (entropy_score, kl_score) in scored_keys:
        keys.append(key)
        entropy_scores.append(entropy_score)
        kl_scores.append(kl_score)

    normalized_entropy_scores, _ = boxcox_transform(entropy_scores)
    normalized_kl_scores, _ = boxcox_transform(kl_scores)
    entropy_z_scores = calculate_z_scores(normalized_entropy_scores)
    kl_z_scores = calculate_z_scores(normalized_kl_scores)

    filtered_keys = [
        entropy_z_score <= z_threshold and kl_z_score <= z_threshold
        for entropy_z_score, kl_z_score in zip(entropy_z_scores, kl_z_scores)
    ]

    return sorted(
        zip(
            keys,
            rrf_score(entropy_scores, kl_scores, entropy_alpha, kl_alpha, offset),
            filtered_keys,
        ),
        key=lambda k: k[1],
        reverse=True,
    )
