from sentry.hybridcloud.models.cacheversion import RegionCacheVersion
from sentry.testutils.helpers import override_options
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_increment_version() -> None:
    assert RegionCacheVersion.incr_version("hello-world") == 1
    assert RegionCacheVersion.incr_version("hello-world") == 2


@django_db_all
def test_increment_version_rollout() -> None:
    with override_options({"sentry.hybridcloud.cacheversion.rollout": 1.0}):
        assert RegionCacheVersion.incr_version("hello-world") == 1
        assert RegionCacheVersion.incr_version("hello-world") == 2
