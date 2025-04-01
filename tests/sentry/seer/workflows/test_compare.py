import math

from sentry.seer.workflows.compare import kl_compare_sets


def test_kl_comparse_sets():
    baseline = {"true": 10.0, "false": 200.0}
    outliers = {"true": 10.0}
    assert math.isclose(kl_compare_sets(baseline, outliers), 8.58, rel_tol=1e-3)

    baseline = {"true": 100.0, "false": 200.0}
    outliers = {"true": 10.0, "false": 20.0}
    assert 0.00000001 > kl_compare_sets(baseline, outliers)  # Essentially 0.
