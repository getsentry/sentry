from __future__ import absolute_import

import itertools

import mmh3
import time

from sentry.utils.redis import load_script


class MinHashIndex(object):
    script = staticmethod(load_script('similarity/index.lua'))

    def __init__(self, cluster, rows, bands, buckets, interval, retention):
        self.cluster = cluster
        self.rows = rows

        sequence = itertools.count()
        self.bands = [[next(sequence) for j in xrange(buckets)] for i in xrange(bands)]
        self.buckets = buckets
        self.interval = interval
        self.retention = retention

    def get_signature(self, value):
        """Generate a signature for a value."""
        return map(
            lambda band: map(
                lambda bucket: min(
                    map(
                        lambda item: mmh3.hash(item, bucket) % self.rows,
                        value,
                    ),
                ),
                band,
            ),
            self.bands,
        )

    def query(self, scope, key, indices, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'QUERY',
            timestamp,
            len(self.bands),
            self.interval,
            self.retention,
            scope,
            key,
        ]

        arguments.extend(indices)

        return [
            [(item, float(score)) for item, score in result]
            for result in
            self.script(
                self.cluster.get_local_client_for_key(scope),
                [],
                arguments,
            )
        ]

    def record(self, scope, key, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'RECORD',
            timestamp,
            len(self.bands),
            self.interval,
            self.retention,
            scope,
            key,
        ]

        for idx, features in items:
            arguments.append(idx)
            arguments.extend([','.join(map('{}'.format, band)) for band in self.get_signature(features)])

        return self.script(
            self.cluster.get_local_client_for_key(scope),
            [],
            arguments,
        )

    def merge(self, scope, destination, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'MERGE',
            timestamp,
            len(self.bands),
            self.interval,
            self.retention,
            scope,
            destination,
        ]

        for idx, source in items:
            arguments.extend([idx, source])

        return self.script(
            self.cluster.get_local_client_for_key(scope),
            [],
            arguments,
        )

    def delete(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'DELETE',
            timestamp,
            len(self.bands),
            self.interval,
            self.retention,
            scope,
        ]

        for idx, key in items:
            arguments.extend([idx, key])

        return self.script(
            self.cluster.get_local_client_for_key(scope),
            [],
            arguments,
        )

    def export(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'EXPORT',
            timestamp,
            len(self.bands),
            self.interval,
            self.retention,
            scope,
        ]

        for idx, key in items:
            arguments.extend([idx, key])

        return self.script(
            self.cluster.get_local_client_for_key(scope),
            [],
            arguments,
        )

    def import_(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'IMPORT',
            timestamp,
            len(self.bands),
            self.interval,
            self.retention,
            scope,
        ]

        for idx, key, data in items:
            arguments.extend([idx, key, data])

        return self.script(
            self.cluster.get_local_client_for_key(scope),
            [],
            arguments,
        )
