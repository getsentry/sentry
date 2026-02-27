from sentry.hybridcloud.models.cacheversion import RegionCacheVersion
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_increment_version() -> None:
    assert RegionCacheVersion.incr_version("hello-world") == 1
    assert RegionCacheVersion.incr_version("hello-world") == 2


# TEMPORARY: intentional failure to test CI reporting (remove after verifying)
def test_intentional_failure_for_ci_reporting():
    assert False, "Intentional failure to test backend CI failure reporting"
