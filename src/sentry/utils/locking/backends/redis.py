from uuid import uuid4

from sentry.utils import redis
from sentry.utils.locking.backends import LockBackend


delete_lock = redis.load_script('utils/locking/delete_lock.lua')


class RedisLockBackend(LockBackend):
    def __init__(self, cluster, prefix='l:', uuid=None):
        if uuid is None:
            uuid = uuid4().hex

        self.cluster = cluster
        self.prefix = prefix
        self.uuid = uuid

    def get_client(self, key, routing_key=None):
        if isinstance(routing_key, int):
            index = routing_key % len(self.cluster.hosts)
            return self.cluster.get_local_client(index)

        if routing_key is not None:
            key = routing_key
        else:
            key = self.__prefix_key(key)

        return self.cluster.get_local_client_for_key(key)

    def __prefix_key(self, key):
        return u'{}{}'.format(self.prefix, key)

    def acquire(self, key, duration, routing_key=None):
        client = self.get_client(key, routing_key)
        if client.set(self.__prefix_key(key), self.uuid, ex=duration, nx=True) is not True:
            raise Exception('Could not acquire lock!')

    def release(self, key, routing_key=None):
        client = self.get_client(key, routing_key)
        delete_lock(client, (self.__prefix_key(key),), (self.uuid,))
