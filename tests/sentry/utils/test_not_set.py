from sentry.utils.not_set import NOT_SET, default_if_not_set


def test_default_if_not_set() -> None:
    assert default_if_not_set(1, NOT_SET) == 1
    assert default_if_not_set(1, 2) == 2
