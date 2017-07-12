from __future__ import absolute_import

import time

from sentry.utils.redis import load_script


index = load_script('similarity/index.lua')


class MinHashIndex(object):
    def __init__(self, cluster, signature_builder, interval, retention):
        self.cluster = cluster
        self.signature_builder = signature_builder
        self.interval = interval
        self.retention = retention

    def query(self, scope, key, indices, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'QUERY',
            timestamp,
            self.signature_builder.bands,
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
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'RECORD',
            timestamp,
            self.signature_builder.bands,
            self.interval,
            self.retention,
            scope,
            key,
        ]

        for idx, features in items:
            arguments.append(idx)
            arguments.extend([','.join(map('{}'.format, band))
                              for band in self.signature_builder(features)])

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
            self.signature_builder.bands,
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
            self.signature_builder.bands,
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
            self.signature_builder.bands,
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
            self.signature_builder.bands,
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
