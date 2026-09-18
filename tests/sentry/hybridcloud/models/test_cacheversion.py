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
        keyname="hello-world",
        version=1,
    )

    assert CellCacheVersion.incr_version("hello-world") == 2
    reload = CellCacheVersion.objects.get(id=original.id)
    assert reload.keyname == "hello-world"
    assert reload.keyname == reload.key
    assert reload.version == 2

    assert CellCacheVersion.incr_version("hello-world") == 3
    assert CellCacheVersion.incr_version("second-hello") == 1
    second = CellCacheVersion.objects.get(keyname="second-hello")
    assert second.keyname == "second-hello"
    assert second.keyname == second.key
    assert second.version == 1


@django_db_all
def test_get_versions() -> None:
    CellCacheVersion.incr_version("hello-world")
    CellCacheVersion.incr_version("hi-world")
    CellCacheVersion.incr_version("hi-world")

    versions = CellCacheVersion.get_versions(["hello-world", "hi-world"])
    assert versions == [1, 2]

    versions = CellCacheVersion.get_versions(["nope", "hello-world", "hi-world"])
    assert versions == [1, 2]


@django_db_all
def test_get_version_map() -> None:
    CellCacheVersion.incr_version("hello-world")
    CellCacheVersion.incr_version("hi-world")
    CellCacheVersion.incr_version("hi-world")

    versions = CellCacheVersion.get_version_map(["hello-world", "hi-world"])
    assert versions == {"hello-world": 1, "hi-world": 2}

    versions = CellCacheVersion.get_version_map(["nope", "hello-world", "hi-world"])
    assert versions == {"hello-world": 1, "hi-world": 2}
