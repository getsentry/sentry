from sentry.hybridcloud.models.cacheversion import CellCacheVersion
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_increment_version() -> None:
    assert CellCacheVersion.incr_version("hello-world") == 1
    assert CellCacheVersion.incr_version("hello-world") == 2


@django_db_all
def test_increment_version_existing_key() -> None:
    # Create a record that looks like data before we started writing to keyname
    original = CellCacheVersion.objects.create(
        key="hello-world",
        version=1,
    )
    assert original.keyname is None, "no keyname initially"

    assert CellCacheVersion.incr_version("hello-world") == 2
    reload = CellCacheVersion.objects.get(id=original.id)
    assert reload.keyname == "hello-world"
    assert reload.key == "hello-world"
    assert reload.version == 2

    assert CellCacheVersion.incr_version("hello-world") == 3
    assert CellCacheVersion.incr_version("second-hello") == 1
    second = CellCacheVersion.objects.get(key="second-hello")
    assert second.key == "second-hello"
    assert second.keyname == "second-hello"
    assert second.version == 1
