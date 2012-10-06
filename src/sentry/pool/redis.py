"""
sentry.pool.redis
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from nydus.db import create_cluster


class RedisCappedPool(object):
    """
    Stores entries in a capped set with pairing entries in a secondary key.
    """
    key_expire = 60 * 60  # 1 hour

    def __init__(self, keyspace, size=1000, hosts=None, router='nydus.db.routers.keyvalue.PartitionRouter', **options):
        super(RedisCappedPool, self).__init__(**options)
        if hosts is None:
            hosts = {
                0: {}  # localhost / default
            }
        self.conn = create_cluster({
            'engine': 'nydus.db.backends.redis.Redis',
            'router': router,
            'hosts': hosts,
        })

    def put(self, item):
        """
        Stores the item in a unique key and adds its identifier to a set:

        SADD keyspace "{}:{}".format(item['id'], item['checksum'])
        SET "{}:{}".format(keyspace, item['checksum']) item

        The size of the set is also checked and cleaned up as needd.
        """
        self.queue.append(item)

    def get(self):
        """
        SPOP keyspace
        """
        return self.queue.pop()
