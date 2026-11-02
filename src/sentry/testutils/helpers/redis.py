from collections.abc import Generator
from contextlib import contextmanager
from typing import Any
from unittest.mock import patch

from django.test.utils import override_settings

from sentry import options as sentry_options
from sentry.buffer.redis import RedisBuffer
from sentry.testutils.helpers import override_options


def mock_redis_buffer():
    return patch("sentry.buffer.backend", new=RedisBuffer())


@contextmanager
def use_redis_cluster(
    cluster_id: str = "cluster",
    high_watermark: int = 100,
    with_settings: dict[str, Any] | None = None,
    with_options: dict[str, Any] | None = None,
    prefix_keys: bool = True,
) -> Generator[None]:
    # Cluster id needs to be different than "default" to distinguish redis instance with redis cluster.
    # In order to run tests that use this helper, run 'devservices up --mode backend-ci' or '--mode full'

    cluster_config = sentry_options.get("redis.clusters")["cluster"]
    if not prefix_keys:
        # For code whose Lua scripts make key names from the values in KEYS. The prefix would
        # go into the middle of those names. Such tests are not isolated between xdist workers:
        # they see the keys of other workers, and a flush on this client deletes those keys too.
        # Clients are cached per cluster id, so use an id that prefixed tests do not use.
        cluster_config = {k: v for k, v in cluster_config.items() if k != "key_prefix"}
    options = {
        "backpressure.high_watermarks.redis": high_watermark,
        "redis.clusters": {cluster_id: cluster_config},
    }

    if with_options:
        options.update(with_options)

    settings = dict(with_settings or {})
    settings["SENTRY_PROCESSING_SERVICES"] = {"redis": {"redis": cluster_id}}

    with override_settings(**settings):
        with override_options(options):
            yield
