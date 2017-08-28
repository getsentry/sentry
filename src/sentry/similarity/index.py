from __future__ import absolute_import

import itertools
import time
from collections import Counter, defaultdict

from sentry.utils.iterators import chunked
from sentry.utils.redis import load_script

index = load_script('similarity/index.lua')


def band(n, value):
    assert len(value) % n == 0
    return list(chunked(value, len(value) / n))


def flatten(value):
    return list(itertools.chain.from_iterable(value))


class MinHashIndex(object):
    def __init__(self, cluster, namespace, signature_builder, bands, interval, retention):
        self.cluster = cluster
        self.namespace = namespace
        self.signature_builder = signature_builder
        self.bands = bands
        self.interval = interval
        self.retention = retention

    def __build_signatures(self, items):
        data = defaultdict(
            lambda: [Counter() for _ in xrange(self.bands)],
        )

        for idx, features in items:
            bands = map(
                ','.join, band(
                    self.bands,
                    map(
                        '{}'.format,
                        self.signature_builder(features),
                    ),
                )
            )

            for i, bucket in enumerate(bands):
                data[idx][i][bucket] += 1

        arguments = [len(data)]
        for idx, bands in data.items():
            arguments.append(idx)
            for buckets in bands:
                arguments.append(len(buckets))
                for bucket, count in buckets.items():
                    arguments.extend([
                        bucket,
                        count,
                    ])

        return arguments

    def __index(self, scope, args):
        # scope must be passed into the script call as a key to allow the
        # cluster client to determine what cluster the script should be
        # executed on. The script itself will use the scope as the hashtag for
        # all redis operations.
        return index(self.cluster, [scope], args)

    def classify(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'CLASSIFY',
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            scope,
        ]

        arguments.extend(self.__build_signatures(items))

        return [
            [(item, float(score)) for item, score in result]
            for result in self.__index(scope, arguments)
        ]

    def compare(self, scope, key, indices, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'COMPARE',
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            scope,
            key,
        ]

        arguments.extend(indices)

        return [
            [(item, float(score)) for item, score in result]
            for result in self.__index(scope, arguments)
        ]

    def record(self, scope, key, items, timestamp=None):
        if not items:
            return  # nothing to do

        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'RECORD',
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            scope,
            key,
        ]

        arguments.extend(self.__build_signatures(items))

        return self.__index(scope, arguments)

    def merge(self, scope, destination, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'MERGE',
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            scope,
            destination,
        ]

        for idx, source in items:
            arguments.extend([idx, source])

        return self.__index(scope, arguments)

    def delete(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'DELETE',
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            scope,
        ]

        for idx, key in items:
            arguments.extend([idx, key])

        return self.__index(scope, arguments)

    def scan(self, scope, indices, batch=1000, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'SCAN',
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            scope,
        ]

        cursors = {idx: 0 for idx in indices}
        while cursors:
            requests = []
            for idx, cursor in cursors.items():
                requests.append([idx, cursor, batch])

            responses = self.__index(scope, arguments + flatten(requests))

            for (idx, _, _), (cursor, chunk) in zip(requests, responses):
                cursor = int(cursor)
                if cursor == 0:
                    del cursors[idx]
                else:
                    cursors[idx] = cursor

                yield idx, chunk

    def flush(self, scope, indices, batch=1000, timestamp=None):
        for index, chunk in self.scan(scope, indices, batch, timestamp):
            if chunk:
                self.cluster.delete(*chunk)

    def export(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'EXPORT',
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            scope,
        ]

        for idx, key in items:
            arguments.extend([idx, key])

        return self.__index(scope, arguments)

    def import_(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'IMPORT',
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            scope,
        ]

        for idx, key, data in items:
            arguments.extend([idx, key, data])

        return self.__index(scope, arguments)


class DummyIndex(object):
    def classify(self, scope, items, timestamp=None):
        return []

    def compare(self, scope, key, indices, timestamp=None):
        return []

    def record(self, scope, key, items, timestamp=None):
        return False

    def merge(self, scope, destination, items, timestamp=None):
        return False

    def delete(self, scope, items, timestamp=None):
        return False

    def scan(self, scope, indices, batch=1000, timestamp=None):
        pass

    def flush(self, scope, indices, batch=1000, timestamp=None):
        pass

    def export(self, scope, items, timestamp=None):
        return False
