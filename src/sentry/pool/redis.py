"""
sentry.pool.redis
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import random
from nydus.db import create_cluster


class RedisCappedPool(object):
    """
    Implements a capped queue based on Reservoir Sampling
    """
    key_expire = 60 * 60  # 1 hour

    def __init__(self, keyspace, size=1000, hosts=None, router='nydus.db.routers.keyvalue.PartitionRouter', **options):
        if hosts is None:
            hosts = {
                0: {}  # localhost / default
            }

        self.conn = create_cluster({
            'engine': 'nydus.db.backends.redis.Redis',
            'router': router,
            'hosts': hosts,
        })
        # We could set this to the maximum value of random.random() (1.0) if we new this pool class
        # could stay instantiated. Unfortunately we'll need an offset per project, which could grow
        # indefinitely and would require us to have an LRU.
        self.offset = None

    def put(self, *items):
        """
        Efficiently samples ``items`` onto the pool's keyspace.
        """
        if self.offset is None:
            self.offset = self.conn.zrange(self.keyspace, self.size, self.size, withscores=True)

        for item in items:
            val = random.random()
            if val < self.offset:
                with self.conn.map() as conn:
                    conn.zadd(self.keyspace, val)
                    conn.zremrangebyrank(self.keyspace, self.size)
                    result = self.conn.zrange(self.keyspace, self.size, self.size, withscores=True)
                self.offset = result[-1][-1]

    def get(self):
        """
        Pops a random item off the sample set.
        """
        val = random.random()
        with self.conn.map() as conn:
            # we have to fetch both values as we don't know which one is actually set
            item_a = conn.zrange(self.keyspace, val, 1, withscores=True)
            item_b = conn.zrevrange(self.keyspace, val, 1, withscores=True)

        # pick either item, doesn't matter
        item, score = (item_a or item_b)

        # remove matching scored item (even if its not the same item)
        self.conn.zremrangebyscore(self.keyspace, val, 1)

    def values(self):
        """
        Returns all samples and clears the pool.
        """
        with self.conn.map() as conn:
            results = conn.zrange(self.keyspace, 0, self.size)
            conn.delete(self.keyspace)

        return results
