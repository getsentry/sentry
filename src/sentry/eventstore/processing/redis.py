from sentry.utils.codecs import JSONCodec
from sentry.utils.kvstore.encoding import KVStorageCodecWrapper
from sentry.utils.kvstore.redis import RedisKVStorage
from sentry.utils.redis import redis_clusters

from .base import EventProcessingStore


class RedisClusterEventProcessingStore(EventProcessingStore):
    """
    Creates an instance of the processing store which uses a Redis Cluster
    client as its backend.
    """

    def __init__(self, **options):
        super().__init__(
            KVStorageCodecWrapper(
                RedisKVStorage(redis_clusters.get(options.pop("cluster", "default"))), JSONCodec()
            )
        )
