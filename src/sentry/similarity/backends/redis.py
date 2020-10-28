from __future__ import absolute_import

import itertools
import time

from django.utils.encoding import force_text

from sentry.similarity.backends.abstract import AbstractIndexBackend
from sentry.utils.iterators import chunked
from sentry.utils.redis import load_script
from sentry.utils.compat import map
from sentry.utils.compat import zip


index = load_script("similarity/index.lua")


def band(n, value):
    assert len(value) % n == 0
    return list(chunked(value, len(value) / n))


def flatten(value):
    return list(itertools.chain.from_iterable(value))


class RedisScriptMinHashIndexBackend(AbstractIndexBackend):
    def __init__(
        self, cluster, namespace, signature_builder, bands, interval, retention, candidate_set_limit
    ):
        self.cluster = cluster
        self.namespace = namespace
        self.signature_builder = signature_builder
        self.bands = bands
        self.interval = interval
        self.retention = retention
        self.candidate_set_limit = candidate_set_limit

    def _build_signature_arguments(self, features):
        if not features:
            return [0] * self.bands

        arguments = []
        for bucket in band(self.bands, self.signature_builder(features)):
            arguments.extend([1, ",".join(map("{}".format, bucket)), 1])
        return arguments

    def __index(self, scope, args):
        # scope must be passed into the script call as a key to allow the
        # cluster client to determine what cluster the script should be
        # executed on. The script itself will use the scope as the hashtag for
        # all redis operations.
        return index(self.cluster, [scope], args)

    def _as_search_result(self, results):
        score_replacements = {
            -1.0: None,  # both items don't have the feature (no comparison)
            -2.0: 0,  # one item doesn't have the feature (totally dissimilar)
        }

        def decode_search_result(result):
            key, scores = result
            return (
                force_text(key),
                map(lambda score: score_replacements.get(score, score), map(float, scores)),
            )

        def get_comparison_key(result):
            key, scores = result

            scores = [score for score in scores if score is not None]

            return (
                sum(scores) / len(scores) * -1,  # average score, descending
                len(scores) * -1,  # number of indexes with scores, descending
                key,  # lexicographical sort on key, ascending
            )

        return sorted(map(decode_search_result, results), key=get_comparison_key)

    def classify(self, scope, items, limit=None, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            "CLASSIFY",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
            limit if limit is not None else -1,
        ]

        for idx, threshold, features in items:
            arguments.extend([idx, threshold])
            arguments.extend(self._build_signature_arguments(features))

        return self._as_search_result(self.__index(scope, arguments))

    def compare(self, scope, key, items, limit=None, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            "COMPARE",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
            limit if limit is not None else -1,
            key,
        ]

        for idx, threshold in items:
            arguments.extend([idx, threshold])

        return self._as_search_result(self.__index(scope, arguments))

    def record(self, scope, key, items, timestamp=None):
        if not items:
            return  # nothing to do

        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            "RECORD",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
            key,
        ]

        for idx, features in items:
            arguments.append(idx)
            arguments.extend(self._build_signature_arguments(features))

        return self.__index(scope, arguments)

    def merge(self, scope, destination, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            "MERGE",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
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
            "DELETE",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
        ]

        for idx, key in items:
            arguments.extend([idx, key])

        return self.__index(scope, arguments)

    def scan(self, scope, indices, batch=1000, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            "SCAN",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
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
            "EXPORT",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
        ]

        for idx, key in items:
            arguments.extend([idx, key])

        return self.__index(scope, arguments)

    def import_(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            "IMPORT",
            timestamp,
            self.namespace,
            self.bands,
            self.interval,
            self.retention,
            self.candidate_set_limit,
            scope,
        ]

        for idx, key, data in items:
            arguments.extend([idx, key, data])

        return self.__index(scope, arguments)
