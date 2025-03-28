import math

from sentry.seer.math import entropy, kl_divergence, laplace_smooth, relative_entropy, rrf_score


def test_laplace_smooth():
    assert laplace_smooth([0.5, 0.5]) == [0.5, 0.5]
    assert laplace_smooth([100, 100]) == [0.5, 0.5]

    result = laplace_smooth([75, 25])
    assert math.isclose(result[0], 0.75, rel_tol=1e-3)
    assert math.isclose(result[1], 0.25, rel_tol=1e-3)

    result = laplace_smooth([67, 33])
    assert math.isclose(result[0], 0.67, rel_tol=1e-3)
    assert math.isclose(result[1], 0.33, rel_tol=1e-3)


def test_kl_divergence():
    result = kl_divergence([0.5, 0.5], [0.8, 0.2])
    assert math.isclose(result, 0.2231, rel_tol=1e-3), result

    result = kl_divergence([0.5, 0.5], [0.7, 0.3])
    assert math.isclose(result, 0.0871, rel_tol=1e-3), result


def test_entropy():
    result = entropy([0.8, 0.2])
    assert math.isclose(result, 0.5004, rel_tol=1e-3), result

    result = entropy([0.7, 0.3])
    assert math.isclose(result, 0.6109, rel_tol=1e-3), result

    # Assert probabilities which do not sum to 1 are scaled.
    assert entropy([0.2, 0.2]) == entropy([0.5, 0.5])

    # Assert invalid inputs have similar error characteristics to scipy.
    assert entropy([]) == 0.0
    assert entropy([-1]) == -math.inf
    assert math.isnan(entropy([0]))


def test_relative_entropy():
    a, b = [0.5, 0.5], [0.8, 0.2]
    rel_entr = relative_entropy(a, b)
    assert len(rel_entr) == 2, rel_entr
    assert math.isclose(rel_entr[0], -0.235, rel_tol=1e-3)
    assert math.isclose(rel_entr[1], 0.458, rel_tol=1e-3)


def test_rrf_score():
    kl_score = kl_divergence([0.5, 0.5], [0.8, 0.2])
    entropy_score = entropy([0.8, 0.2])
    assert math.isclose(rrf_score(entropy_score, kl_score), 5.1838, rel_tol=1e-3)
