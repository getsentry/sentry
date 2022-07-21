from unittest import mock

import pytest

from sentry.relay.projectconfig_cache import redis
from sentry.testutils.helpers import override_options


def test_delete_count(monkeypatch):
    cache = redis.RedisProjectConfigCache()
    incr_mock = mock.Mock()
    monkeypatch.setattr(redis.metrics, "incr", incr_mock)
    cache.set_many({"a": 1})

    cache.delete_many(["a", "b"])

    assert incr_mock.call_args == mock.call(
        "relay.projectconfig_cache.write", amount=1, tags={"action": "delete"}
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    "option_value, should_use_compression",
    [
        (["fake-dsn-1", "fake-dsn-2"], True),
        (1.0, True),
        (0.0, False),
        ("invalid-value", False),
    ],
)
def test_read_write(option_value, should_use_compression):
    cache = redis.RedisProjectConfigCache()
    my_key = "fake-dsn-1"
    with override_options({redis.COMPRESSION_OPTION: option_value}):
        assert redis._use_compression(my_key) == should_use_compression
        cache.set_many({my_key: "my-value"})
        assert cache.get(my_key) == "my-value"
