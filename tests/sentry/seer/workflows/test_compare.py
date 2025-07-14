import math

from sentry.seer.workflows.compare import (
    keyed_kl_score,
    keyed_rrf_score,
    keyed_rrf_score_with_filter,
)


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


def test_synthetic_baseline_kl():
    """
    This test checks the KL divergence for the synthetic generated baseline, describe in the tech spec.
    There are 4 attributes: country, device, error_code, browser.
    All the attributes are uniformly distributed in the baseline. Two changes are introduced to the outliers:
      A new value "unknown" is added to the browser attribute, making it the most distributed attribute.
      The values for country are also skewed making "fr" the most frequent one.
    The distributions of error_code and device are kept the same.
    """

    baseline = [
        ("country", "fr", 249871.0),
        ("country", "us", 249662.0),
        ("country", "uk", 249366.0),
        ("country", "de", 249166.0),
        ("device", "tablet", 333215.0),
        ("device", "mobile", 332586.0),
        ("device", "desktop", 332264.0),
        ("error_code", "404", 333386.0),
        ("error_code", "400", 332364.0),
        ("error_code", "504", 332315.0),
        ("browser", "edge", 249804.0),
        ("browser", "firefox", 249578.0),
        ("browser", "chrome", 249489.0),
        ("browser", "safari", 249194.0),
    ]
    outliers = [
        ("country", "fr", 987.0),
        ("country", "uk", 381.0),
        ("country", "us", 367.0),
        ("country", "de", 200.0),
        ("device", "desktop", 695.0),
        ("device", "mobile", 638.0),
        ("device", "tablet", 602.0),
        ("error_code", "404", 691.0),
        ("error_code", "504", 632.0),
        ("error_code", "400", 612.0),
        ("browser", "unknown", 1351.0),
        ("browser", "safari", 197.0),
        ("browser", "edge", 195.0),
        ("browser", "firefox", 192.0),
    ]

    scores = keyed_kl_score(
        baseline,
        outliers,
        total_baseline=998065,  # hardcoded
        total_outliers=1935,  # hardcoded
    )
    attributes = [s[0] for s in scores]
    assert attributes == ["browser", "country", "device", "error_code"]
    kl_scores = [s[1] for s in scores]
    assert math.isclose(kl_scores[0], 3.9547, rel_tol=1e-3)
    assert math.isclose(kl_scores[1], 0.17, abs_tol=1e-3)


def test_zero_kl():
    """
    This test checks the if the distirbution of the outliers is more or less the same as the baseline, the KL divergence should be close to 0.
    """
    baseline = [
        ("browser", "edge", 249804.0),
        ("browser", "firefox", 249578.0),
        ("browser", "chrome", 249489.0),
        ("browser", "safari", 249194.0),
    ]
    outliers = [
        ("browser", "chrome", 194.0),
        ("browser", "safari", 197.0),
        ("browser", "edge", 195.0),
        ("browser", "firefox", 192.0),
    ]

    scores = keyed_kl_score(
        baseline,
        outliers,
        total_baseline=int(sum(i[2] for i in baseline)),
        total_outliers=int(sum(i[2] for i in outliers)),
    )
    assert math.isclose(scores[0][1], 0.0, abs_tol=1e-4)


def test_entropy_only():
    """
    This test ranks the attributes by entropy only.
    'country' has zero entropy, so it will be ranked the highest. 'browser' has the highest entropy, so it will be ranked the lowest.
    """
    # 1000 rows in the baseline
    baseline = [
        ("device", "desktop", 1000.0),
        ("country", "fr", 1000.0),
        ("browser", "edge", 1000.0),
    ]
    # 100 rows in the outliers
    outlier = [
        ("country", "fr", 100.0),  # zero entropy
        ("device", "tablet", 33.0),
        ("device", "mobile", 33.0),
        ("device", "desktop", 34.0),
        ("browser", "edge", 20.0),
        ("browser", "firefox", 20.0),
        ("browser", "chrome", 20.0),
        ("browser", "safari", 20.0),
        ("browser", "brave", 20.0),
    ]

    scores = keyed_rrf_score(
        baseline,
        outlier,
        total_baseline=1000,
        total_outliers=100,
        entropy_alpha=1.0,
        kl_alpha=0.0,
    )
    attributes = [s[0] for s in scores]
    assert attributes == ["country", "device", "browser"]


def test_small_support():
    """
    This test checkes the that logic for adding unseen values to the distribution works.
    This logic is used to prevent small support attributes from being ranked higher than large support attributes.
    Attribute 'device' has the lowest support (it is only present in 11 rows out of 1000), but large difference in distribution of baseline and outlier. So if there was no unseen value, 'device' would be ranked the highest.
    But since we add the unseen value, 'device' will be ranked the lowest.
    """
    # 1000 rows in the baseline
    baseline = [
        ("device", "desktop", 10.0),
        ("device", "mobile", 1.0),
        ("browser", "edge", 350.0),
        ("browser", "chrome", 650.0),
        ("country", "fr", 300.0),
        ("country", "us", 700.0),
    ]
    # 100 rows in the outlier
    outlier = [
        ("device", "desktop", 1.0),
        ("device", "mobile", 10.0),
        ("browser", "edge", 65.0),
        ("browser", "chrome", 35.0),
        ("country", "fr", 70.0),
        ("country", "us", 30.0),
    ]

    scores = keyed_kl_score(
        baseline,
        outlier,
        total_baseline=1000,
        total_outliers=100,
    )
    attributes = [s[0] for s in scores]
    assert attributes == ["country", "browser", "device"]


def test_keyed_rrf_score_with_filter_basic():
    """
    Test basic functionality of keyed_rrf_score_with_filter
    """
    baseline = [
        ("key", "true", 10),
        ("key", "false", 200),
        ("other", "true", 1000),
        ("other", "false", 5000),
    ]
    outliers = [("key", "true", 10), ("other", "true", 100), ("other", "false", 500)]

    scores = keyed_rrf_score_with_filter(
        baseline,
        outliers,
        total_baseline=sum(i[2] for i in baseline),
        total_outliers=sum(i[2] for i in outliers),
        z_threshold=1.5,
    )

    # Should return tuples of (key, score, filtered_boolean)
    assert len(scores) == 2
    for key, score, filtered in scores:
        assert isinstance(key, str)
        assert isinstance(score, float)
        assert isinstance(filtered, bool)
        assert score >= 0


def test_keyed_rrf_score_with_filter_threshold_behavior():
    """
    Test filtering behavior with different z_threshold values
    """
    baseline = [
        ("key", "true", 10),
        ("key", "false", 200),
        ("other", "true", 1000),
        ("other", "false", 5000),
    ]
    outliers = [("key", "true", 10), ("other", "true", 100), ("other", "false", 500)]

    # With low threshold, no keys should be filtered
    high_threshold_scores = keyed_rrf_score_with_filter(
        baseline,
        outliers,
        total_baseline=sum(i[2] for i in baseline),
        total_outliers=sum(i[2] for i in outliers),
        z_threshold=-10.0,
    )

    for key, score, filtered in high_threshold_scores:
        assert not filtered, f"Key {key} should not be filtered with high threshold"


def test_keyed_rrf_score_with_filter_empty_inputs():
    """
    Test with empty inputs
    """
    scores = keyed_rrf_score_with_filter(
        [], [], total_baseline=0, total_outliers=0, z_threshold=1.5
    )
    assert scores == []


def test_keyed_rrf_score_with_filter_consistency_with_regular_rrf():
    """
    Test that the scores are consistent with keyed_rrf_score
    """
    baseline = [
        ("key", "true", 10),
        ("key", "false", 200),
        ("other", "true", 1000),
        ("other", "false", 5000),
    ]
    outliers = [("key", "true", 10), ("other", "true", 100), ("other", "false", 500)]

    # Get scores from both functions
    filtered_scores = keyed_rrf_score_with_filter(
        baseline,
        outliers,
        total_baseline=sum(i[2] for i in baseline),
        total_outliers=sum(i[2] for i in outliers),
        z_threshold=1.5,
    )

    regular_scores = keyed_rrf_score(
        baseline,
        outliers,
        total_baseline=sum(i[2] for i in baseline),
        total_outliers=sum(i[2] for i in outliers),
    )

    # Extract just the key-score pairs and sort them for comparison
    filtered_key_scores = sorted([(key, score) for key, score, _ in filtered_scores])
    regular_key_scores = sorted(regular_scores)

    # The scores should be identical
    for (key1, score1), (key2, score2) in zip(filtered_key_scores, regular_key_scores):
        assert key1 == key2
        assert math.isclose(score1, score2, rel_tol=1e-9)
