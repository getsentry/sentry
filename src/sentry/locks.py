from sentry.utils import redis
from sentry.utils.locking.backends.redis import RedisLockBackend
from sentry.utils.locking.manager import LockManager

locks = LockManager(RedisLockBackend(redis.clusters.get("default")))
