import math

from sentry.seer.math import kl_divergence, laplace_smooth, relative_entropy


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
