from django.conf import settings

from sentry.workflow_engine.buffer.redis_hash_sorted_set_buffer import RedisHashSortedSetBuffer

# Rules processing Redis buffer configured independently from the main Buffer service
_backend = RedisHashSortedSetBuffer(**getattr(settings, "SENTRY_BUFFER_OPTIONS", {}))


def get_backend() -> RedisHashSortedSetBuffer:
    """
    Retrieve the standalone Redis buffer for rules processing.
    This provides hash and sorted set operations without the Service interface.
    """
    return _backend
