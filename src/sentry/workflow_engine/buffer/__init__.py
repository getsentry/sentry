from typing import int
from django.conf import settings

from sentry.workflow_engine.buffer.redis_hash_sorted_set_buffer import RedisHashSortedSetBuffer

_backend = RedisHashSortedSetBuffer(
    "SENTRY_WORKFLOW_BUFFER_OPTIONS", settings.SENTRY_WORKFLOW_BUFFER_OPTIONS
)


def get_backend() -> RedisHashSortedSetBuffer:
    return _backend
