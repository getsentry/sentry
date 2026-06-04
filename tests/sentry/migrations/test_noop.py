import pytest


@pytest.mark.migrations
def test_noop() -> None:
    pass  # there must be at least one migrations tests or the suite fails
