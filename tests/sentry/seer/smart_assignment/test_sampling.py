from sentry.seer.smart_assignment.sampling import should_sample


def test_rate_bounds():
    assert should_sample(123, 0.0) is False
    assert should_sample(123, 1.0) is True


def test_deterministic():
    assert should_sample(123, 0.5) == should_sample(123, 0.5)


def test_monotonic_in_rate():
    # A group sampled at a lower rate is always sampled at a higher rate.
    for group_id in range(200):
        if should_sample(group_id, 0.1):
            assert should_sample(group_id, 0.5)


def test_rate_is_roughly_honored():
    n = 5000
    sampled = sum(should_sample(gid, 0.1) for gid in range(n))
    # Deterministic hash over a contiguous range should land near the target.
    assert 0.07 * n < sampled < 0.13 * n
