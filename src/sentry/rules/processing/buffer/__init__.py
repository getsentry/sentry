from django.conf import settings

from sentry.workflow_engine.buffer.redis_hash_sorted_set_buffer import RedisHashSortedSetBuffer

# NB: This still uses the same Redis setup as the sentry.buffer.redis.RedisBuffer for backward compatibility.
_backend = RedisHashSortedSetBuffer("SENTRY_BUFFER_OPTIONS", settings.SENTRY_BUFFER_OPTIONS)


def get_backend() -> RedisHashSortedSetBuffer:
    return _backend
