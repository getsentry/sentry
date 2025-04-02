import math

from sentry.seer.workflows.compare import keyed_kl_score, kl_score


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
        total_a=sum(map(lambda v: v[2], baseline)),
        total_b=sum(map(lambda v: v[2], outliers)),
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
        total_a=sum(map(lambda v: v[2], baseline)),
        total_b=sum(map(lambda v: v[2], outliers)),
    )
    assert scores[0][0] == "key"
    assert math.isclose(scores[0][1], 8.58, rel_tol=1e-3)


def test_kl_score():
    baseline = [("true", 10.0), ("false", 200.0)]
    outliers = [("true", 10.0)]
    assert math.isclose(
        kl_score(
            baseline,
            outliers,
            total_a=sum(map(lambda v: v[1], baseline)),
            total_b=sum(map(lambda v: v[1], outliers)),
        ),
        8.58,
        rel_tol=1e-3,
    )

    baseline = [("true", 100.0), ("false", 200.0)]
    outliers = [("true", 10.0), ("false", 20.0)]
    assert 0.00000001 > kl_score(
        baseline,
        outliers,
        total_a=sum(map(lambda v: v[1], baseline)),
        total_b=sum(map(lambda v: v[1], outliers)),
    )  # Essentially 0.
