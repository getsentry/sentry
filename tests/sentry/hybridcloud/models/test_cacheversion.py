from sentry.hybridcloud.models.cacheversion import CellCacheVersion
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_increment_version() -> None:
    assert CellCacheVersion.incr_version("hello-world") == 1
    assert CellCacheVersion.incr_version("hello-world") == 2
