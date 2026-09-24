from sentry.relay.projectconfig_cache import redis
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_read_write() -> None:
    cache = redis.RedisProjectConfigCache()

    dsn1 = "fake-dsn-1"
    value1 = {"my-value": "foo", "rev": "my_rev_123"}

    dsn2 = "fake-dsn-2"
    value2 = {"my-value": "bar", "has_no_rev": "123"}

    cache.set_many({dsn1: value1, dsn2: value2})
    assert cache.get(dsn1) == value1
    assert cache.get(dsn2) == value2

    assert cache.get_rev(dsn1) == "my_rev_123"
    assert cache.get_rev(dsn2) is None

    del value1["rev"]
    cache.set_many({dsn1: value1})
    assert cache.get(dsn1) == value1
    assert cache.get_rev(dsn1) is None
