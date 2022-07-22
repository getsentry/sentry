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
    "enabled_dsns, sample_rate, should_use_compression",
    [
        (["fake-dsn-1", "fake-dsn-2"], 0.0, True),
        (["fake-dsn-1", "fake-dsn-2"], 1.0, True),
        ([], 1.0, True),
        ([], 0.0, False),
    ],
)
def test_read_write(enabled_dsns, sample_rate, should_use_compression):
    cache = redis.RedisProjectConfigCache()
    my_key = "fake-dsn-1"
    with override_options(
        {
            "relay.project-config-cache-compress": enabled_dsns,
            "relay.project-config-cache-compress-sample-rate": sample_rate,
        }
    ):
        assert redis._use_compression(my_key) == should_use_compression
        cache.set_many({my_key: "my-value"})
        assert cache.get(my_key) == "my-value"
