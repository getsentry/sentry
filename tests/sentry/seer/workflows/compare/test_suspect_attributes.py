from sentry.seer.workflows.compare import suspect_attributes


def test_suspect_attributes():
    result = suspect_attributes(
        baseline=[("a", [("aa", 10), ("ab", 100)])],
        selection=[("a", [("ab", 100)])],
        num_top_attrs=2,
        num_top_buckets=3,
        referrer="none",
    )

    assert len(result) == 1
    assert result[0][0] == "a"
    assert result[0][1] == ["aa", "ab"]
    assert 0 < result[0][2] < 1
