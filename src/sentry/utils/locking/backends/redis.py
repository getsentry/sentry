from uuid import uuid4

from sentry.utils import redis
from sentry.utils.locking.backends import LockBackend

delete_lock = redis.load_script("utils/locking/delete_lock.lua")


class RedisLockBackend(LockBackend):
    def __init__(self, cluster, prefix="l:", uuid=None):
        if uuid is None:
            uuid = uuid4().hex

        self.cluster = cluster
        self.prefix = prefix
        self.uuid = uuid

    def get_client(self, key, routing_key=None):
        # This is a bit of an abstraction leak, but if an integer is provided
        # we use that value to determine placement rather than the cluster
        # router. This leaking allows us us to have more fine-grained control
        # when data is already placed within partitions where the router
        # wouldn't have placed it based on the key hash, and maintain data
        # locality and failure isolation within those partitions. (For example,
        # the entirety of a digest is bound to a specific partition by the
        # *digest* key, even though a digest is composed of multiple values at
        # different keys that would otherwise be placed on different
        # partitions.)
        if isinstance(routing_key, int):
            index = routing_key % len(self.cluster.hosts)
            return self.cluster.get_local_client(index)

        if routing_key is not None:
            key = routing_key
        else:
            key = self.prefix_key(key)

        return self.cluster.get_local_client_for_key(key)

    def prefix_key(self, key):
        return f"{self.prefix}{key}"

    def acquire(self, key, duration, routing_key=None):
        client = self.get_client(key, routing_key)
        full_key = self.prefix_key(key)
        if client.set(full_key, self.uuid, ex=duration, nx=True) is not True:
            raise Exception(f"Could not set key: {full_key!r}")

    def release(self, key, routing_key=None):
        client = self.get_client(key, routing_key)
        delete_lock(client, (self.prefix_key(key),), (self.uuid,))

    def locked(self, key, routing_key=None):
        client = self.get_client(key, routing_key)
        return client.get(self.prefix_key(key)) is not None
