from unittest import mock

from sentry.relay.projectconfig_cache import redis


def test_delete_count(monkeypatch):
    cache = redis.RedisProjectConfigCache()
    incr_mock = mock.Mock()
    monkeypatch.setattr(redis.metrics, "incr", incr_mock)
    cache.set_many({"a": 1})

    cache.delete_many(["a", "b"])

    assert incr_mock.call_args == mock.call(
        "relay.projectconfig_cache.write", amount=1, tags={"action": "delete"}
    )
