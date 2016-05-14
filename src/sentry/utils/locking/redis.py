from uuid import uuid4

from sentry.utils.locking.lock import Lock
from sentry.utils.locking.manager import LockManager
from sentry.utils import redis


delete_lock = redis.load_script('utils/locking/delete_lock.lua')


class RedisLockManager(LockManager):
    def __init__(self, cluster=None, prefix='l:', uuid=None):
        if cluster is None:
            cluster = redis.clusters.get('default')

        if uuid is None:
            uuid = uuid4().hex

        self.cluster = cluster
        self.prefix = prefix
        self.uuid = uuid

    def __prefix_key(self, key):
        return self.prefix + str(key)

    def get(self, *args, **kwargs):
        return Lock(self, *args, **kwargs)

    def acquire(self, key, duration):
        key = self.__prefix_key(key)
        client = self.cluster.get_local_client_for_key(key)
        if client.set(key, self.uuid, ex=duration, nx=True) is not True:
            raise Exception('Could not acquire lock!')

    def release(self, key):
        key = self.__prefix_key(key)
        client = self.cluster.get_local_client_for_key(key)
        delete_lock(client, (key,), (self.uuid,))
