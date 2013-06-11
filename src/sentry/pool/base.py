"""
sentry.pool.base
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


class Pool(object):
    def __init__(self, keyspace):
        self.keyspace = keyspace
        self.queue = []

    def put(self, item):
        self.queue.append(item)

    def get(self):
        return self.queue.pop()
