import math

from sentry.seer.workflows.compare import keyed_kl_score, keyed_rrf_score


def test_keyed_kl_score():
    baseline = [
        ("key", "true", 10),
        ("key", "false", 200),
        ("other", "true", 1000),
        ("other", "false", 5000),
    ]
    outliers = [("key", "true", 10), ("other", "true", 100), ("other", "false", 500)]

    scores = keyed_kl_score(
        baseline,
        outliers,
        total_baseline=sum(i[2] for i in baseline),
        total_outliers=sum(i[2] for i in outliers),
    )
    assert scores[0][0] == "key"
    assert math.isclose(scores[0][1], 0.297377, rel_tol=1e-3)
    assert scores[1][0] == "other"
    assert math.isclose(scores[1][1], 0.007, abs_tol=1e-3)

    # Assert that without a large unseen value (missing the other key) the suspicion probability
    # is higher.
    baseline = [("key", "true", 10), ("key", "false", 200)]
    outliers = [("key", "true", 10)]

    scores = keyed_kl_score(
        baseline,
        outliers,
        total_baseline=sum(i[2] for i in baseline),
        total_outliers=sum(i[2] for i in outliers),
    )
    assert scores[0][0] == "key"
    assert math.isclose(scores[0][1], 8.58, rel_tol=1e-3)


def test_keyed_rrf_score():
    baseline = [
        ("key", "true", 10),
        ("key", "false", 200),
        ("other", "true", 1000),
        ("other", "false", 5000),
    ]
    outliers = [("key", "true", 10), ("other", "true", 100), ("other", "false", 500)]

    scores = keyed_rrf_score(
        baseline,
        outliers,
        total_baseline=sum(i[2] for i in baseline),
        total_outliers=sum(i[2] for i in outliers),
    )
    assert scores[0][0] == "key"
    assert math.isclose(scores[0][1], 0.01639, rel_tol=1e-3)
    assert scores[1][0] == "other"
    assert math.isclose(scores[1][1], 0.01612, abs_tol=1e-3)
