import math

from sentry.seer.math import (
    boxcox_transform,
    calculate_z_scores,
    entropy,
    kl_divergence,
    laplace_smooth,
    rank_min,
    relative_entropy,
    rrf_score,
)


def test_laplace_smooth():
    assert laplace_smooth([0.5, 0.5]) == [0.5, 0.5]
    assert laplace_smooth([100, 100]) == [0.5, 0.5]

    result = laplace_smooth([75, 25])
    assert math.isclose(result[0], 0.75, rel_tol=1e-3)
    assert math.isclose(result[1], 0.25, rel_tol=1e-3)

    result = laplace_smooth([67, 33])
    assert math.isclose(result[0], 0.67, rel_tol=1e-3)
    assert math.isclose(result[1], 0.33, rel_tol=1e-3)

    result = laplace_smooth([0, 1])
    assert result[0] > 0
    assert result[1] < 1


def test_kl_divergence():
    result = kl_divergence([0.5, 0.5], [0.8, 0.2])
    assert math.isclose(result, 0.2231, rel_tol=1e-3), result

    result = kl_divergence([0.5, 0.5], [0.7, 0.3])
    assert math.isclose(result, 0.0871, rel_tol=1e-3), result


def test_relative_entropy():
    a, b = [0.5, 0.5], [0.8, 0.2]
    rel_entr = relative_entropy(a, b)
    assert len(rel_entr) == 2, rel_entr
    assert math.isclose(rel_entr[0], -0.235, rel_tol=1e-3)
    assert math.isclose(rel_entr[1], 0.458, rel_tol=1e-3)


def test_entropy():
    result = entropy([0.8, 0.2])
    assert math.isclose(result, 0.5004, rel_tol=1e-3), result

    result = entropy([0.7, 0.3])
    assert math.isclose(result, 0.6109, rel_tol=1e-3), result

    # Assert probabilities which do not sum to 1 are scaled.
    assert entropy([0.2, 0.2]) == entropy([0.5, 0.5])

    # Assert negative distributions have their signs flipped.
    assert entropy([0.7, 0.3]) == entropy([-0.7, -0.3])
    assert entropy([1]) == entropy([-1])

    # Assert empty distributions return 0.
    assert entropy([]) == 0.0
    assert entropy([0, 0, 0]) == 0.0

    # Negative values in a positive distribution send entropy to negative infinity.
    assert entropy([-1, 2]) == -math.inf
    assert entropy([1, -2]) == -math.inf


def test_rrf_score():
    rrf_scores = rrf_score(
        # Entropy of the selection set.
        entropy_scores=[
            entropy([0.8, 0.2]),
            entropy([0.999, 0.001]),
            entropy([0.5, 0.5]),
        ],
        # KL divergence of the baseline and selection set.
        kl_scores=[
            kl_divergence([0.5, 0.5], [0.8, 0.2]),
            kl_divergence([0.01, 0.99], [0.999, 0.001]),
            kl_divergence([0.5, 0.5], [0.5, 0.5]),
        ],
    )
    assert len(rrf_scores) == 3
    assert math.isclose(rrf_scores[0], 0.01612, rel_tol=1e-3)  # Rank 2.
    assert math.isclose(rrf_scores[1], 0.01639, rel_tol=1e-3)  # Rank 1.
    assert math.isclose(rrf_scores[2], 0.01587, rel_tol=1e-3)  # Rank 3.


def test_rank_min():
    assert rank_min(xs=[1, 2, 2, 2, 3], ascending=False) == [3, 2, 2, 2, 1]
    assert rank_min(xs=[1, 2, 2, 2, 3], ascending=True) == [1, 2, 2, 2, 3]


def test_boxcox_transform():
    # Test with lambda = 0 (log transformation)
    values = [1.0, 2.0, 4.0, 8.0]
    transformed, lambda_used = boxcox_transform(values, lambda_param=0.0)
    expected = [math.log(v) for v in values]
    assert lambda_used == 0.0
    for t, e in zip(transformed, expected):
        assert math.isclose(t, e, rel_tol=1e-9)

    # Test with lambda = 1 (no transformation, just (x-1)/1 = x-1)
    transformed, lambda_used = boxcox_transform(values, lambda_param=1.0)
    expected = [v - 1.0 for v in values]
    assert lambda_used == 1.0
    for t, e in zip(transformed, expected):
        assert math.isclose(t, e, rel_tol=1e-9)

    # Test with lambda = 0.5 (square root transformation)
    transformed, lambda_used = boxcox_transform(values, lambda_param=0.5)
    expected = [(math.sqrt(v) - 1.0) / 0.5 for v in values]
    assert lambda_used == 0.5
    for t, e in zip(transformed, expected):
        assert math.isclose(t, e, rel_tol=1e-9)

    # Test auto lambda detection
    transformed, lambda_used = boxcox_transform(values, lambda_param=None)
    assert isinstance(lambda_used, float)
    assert len(transformed) == len(values)

    # Test empty input
    transformed, lambda_used = boxcox_transform([], lambda_param=0.0)
    assert transformed == []
    assert lambda_used == 0.0


def test_calculate_z_scores():
    values = [1.0, 2.0, 3.0, 4.0, 5.0]
    z_scores = calculate_z_scores(values)

    expected_mean = 3.0
    expected_std = math.sqrt(2.0)
    expected = [(v - expected_mean) / expected_std for v in values]

    assert len(z_scores) == len(values)
    for z, e in zip(z_scores, expected):
        assert math.isclose(z, e, rel_tol=1e-9)

    same_values = [5.0, 5.0, 5.0, 5.0]
    z_scores = calculate_z_scores(same_values)
    assert all(z == 0.0 for z in z_scores)

    assert calculate_z_scores([]) == []

    single_z = calculate_z_scores([42.0])
    assert single_z == [0.0]

    simple_values = [0.0, 10.0]
    z_scores = calculate_z_scores(simple_values)
    assert math.isclose(z_scores[0], -1.0, rel_tol=1e-9)
    assert math.isclose(z_scores[1], 1.0, rel_tol=1e-9)
