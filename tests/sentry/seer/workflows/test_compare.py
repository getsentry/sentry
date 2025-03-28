import math

from sentry.seer.workflows.compare import kl_compare_sets, rrf_compare_sets


def test_kl_comparse_sets():
    baseline = {"true": 10, "false": 200}
    outliers = {"true": 10}
    assert math.isclose(kl_compare_sets(baseline, outliers), 8.58, rel_tol=1e-3)

    baseline = {"true": 100, "false": 200}
    outliers = {"true": 10, "false": 20}
    assert 0.00000001 > kl_compare_sets(baseline, outliers)  # Essentially 0.


def test_rrf_compare_sets():
    baseline = {"true": 10, "false": 200}
    outliers = {"true": 10}
    assert math.isclose(rrf_compare_sets(baseline, outliers), 0.025, rel_tol=1e-4)

    baseline = {"true": 100, "false": 200}
    outliers = {"true": 10, "false": 20}
    assert math.isclose(rrf_compare_sets(baseline, outliers), 0.026526, rel_tol=1e-4)
