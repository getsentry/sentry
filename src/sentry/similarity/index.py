from __future__ import absolute_import

import time

from sentry.utils.iterators import chunked
from sentry.utils.redis import load_script


index = load_script('similarity/index.lua')


def band(n, value):
    assert len(value) % n == 0
    return list(chunked(value, len(value) / n))


class MinHashIndex(object):
    def __init__(self, cluster, namespace, signature_builder, bands, interval, retention):
        self.cluster = cluster
        self.namespace = namespace
        self.signature_builder = signature_builder
        self.bands = bands
        self.interval = interval
        self.retention = retention

    def query(self, scope, key, indices, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'QUERY',
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
            for result in
            index(
                self.cluster.get_local_client_for_key(scope),
                [],
                arguments,
            )
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

        for idx, features in items:
            arguments.append(idx)
            arguments.extend([
                ','.join(map('{}'.format, b))
                for b in
                band(self.bands, self.signature_builder(features))
            ])

        return index(
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
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            scope,
            destination,
        ]

        for idx, source in items:
            arguments.extend([idx, source])

        return index(
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
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            scope,
        ]

        for idx, key in items:
            arguments.extend([idx, key])

        return index(
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
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            scope,
        ]

        for idx, key in items:
            arguments.extend([idx, key])

        return index(
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
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            scope,
        ]

        for idx, key, data in items:
            arguments.extend([idx, key, data])

        return index(
            self.cluster.get_local_client_for_key(scope),
            [],
            arguments,
        )
