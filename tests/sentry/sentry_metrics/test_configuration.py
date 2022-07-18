import pytest

from sentry.sentry_metrics.configuration import UseCaseKey


def test_use_case_id_from_str():
    assert UseCaseKey.from_str("performance") == UseCaseKey.PERFORMANCE
    assert UseCaseKey.from_str("release-health") == UseCaseKey.RELEASE_HEALTH
    assert UseCaseKey.from_str("releaseHealth") == UseCaseKey.RELEASE_HEALTH


def test_use_case_id_from_str_raise_exc():
    with pytest.raises(ValueError):
        UseCaseKey.from_str("")
