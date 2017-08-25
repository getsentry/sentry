from __future__ import absolute_import

import itertools
import time

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

    def _build_signature_arguments(self, features):
        if not features:
            return [0] * self.bands

        arguments = []
        for bucket in band(self.bands, self.signature_builder(features)):
            arguments.extend([1, ','.join(map('{}'.format, bucket)), 1])
        return arguments

    def _get_connection(self, scope):
        return self.cluster.get_local_client_for_key(scope)

    def _as_search_result(self, indices, result):
        replacements = {
            -1: None,
            -2: 0,
        }

        def get_comparison_key((key, scores)):
            scores = filter(
                lambda score: score is not None,
                map(
                    lambda score: replacements.get(score, score),
                    scores,
                ),
            )

            return (
                sum(scores) / len(scores) * -1,  # average score
                len(scores) * -1,  # number of indexes with scores, tiebreaker
                key,  # lex sort, tiebreaker
            )

        # TODO: Clean this up, don't map so much.
        return map(
            lambda (key, scores): (
                key,
                map(lambda score: score if score >= 0 else None, scores),
            ),
            sorted(
                map(
                    lambda (key, scores): (
                        key,
                        map(float, scores),
                    ),
                    result,
                ),
                key=get_comparison_key,
            ),
        )

    def classify(self, scope, items, limit=None, timestamp=None):
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
            limit if limit is not None else -1,
        ]

        for idx, threshold, features in items:
            arguments.extend([idx, threshold])
            arguments.extend(self._build_signature_arguments(features))

        return self._as_search_result(
            [idx for idx, threshold, features in items],
            index(self._get_connection(scope), [], arguments),
        )

    def compare(self, scope, key, items, limit=None, timestamp=None):
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
            limit if limit is not None else -1,
            key,
        ]

        for idx, threshold in items:
            arguments.extend([idx, threshold])

        return self._as_search_result(
            [idx for idx, threshold in items],
            index(self._get_connection(scope), [], arguments),
        )

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
            arguments.extend(self._build_signature_arguments(features))

        return index(
            self._get_connection(scope),
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
            self._get_connection(scope),
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
            self._get_connection(scope),
            [],
            arguments,
        )

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

        clients = map(
            self.cluster.get_local_client,
            self.cluster.hosts,
        )

        for client in clients:
            cursors = {idx: 0 for idx in indices}
            while cursors:
                requests = []
                for idx, cursor in cursors.items():
                    requests.append([idx, cursor, batch])

                responses = index(
                    client,
                    [],
                    arguments + flatten(requests),
                )

                for (idx, _, _), (cursor, chunk) in zip(requests, responses):
                    cursor = int(cursor)
                    if cursor == 0:
                        del cursors[idx]
                    else:
                        cursors[idx] = cursor

                    yield client, idx, chunk

    def flush(self, scope, indices, batch=1000, timestamp=None):
        for client, index, chunk in self.scan(scope, indices, batch, timestamp):
            if chunk:
                client.delete(*chunk)

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
            self._get_connection(scope),
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
            self._get_connection(scope),
            [],
            arguments,
        )
