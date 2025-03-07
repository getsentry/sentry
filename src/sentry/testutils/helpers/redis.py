from collections.abc import Generator
from contextlib import contextmanager
from typing import Any
from unittest.mock import patch

from django.test.utils import override_settings

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
) -> Generator[None]:
    # Cluster id needs to be different than "default" to distinguish redis instance with redis cluster.
    # In order to run tests that use this helper, run 'devservices up --mode backend-ci' or '--mode full'

    options = {
        "backpressure.high_watermarks.redis": high_watermark,
        "redis.clusters": {
            cluster_id: {
                "is_redis_cluster": True,
                "hosts": [
                    {"host": "0.0.0.0", "port": 7000},
                    {"host": "0.0.0.0", "port": 7001},
                    {"host": "0.0.0.0", "port": 7002},
                    {"host": "0.0.0.0", "port": 7003},
                    {"host": "0.0.0.0", "port": 7004},
                    {"host": "0.0.0.0", "port": 7005},
                ],
            }
        },
    }

    if with_options:
        options.update(with_options)

    settings = dict(with_settings or {})
    settings["SENTRY_PROCESSING_SERVICES"] = {"redis": {"redis": cluster_id}}

    with override_settings(**settings):
        with override_options(options):
            yield
