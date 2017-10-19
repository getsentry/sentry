from __future__ import absolute_import

import functools
import itertools
import struct
import time
from collections import Counter, defaultdict

from sentry.similarity.backends.abstract import AbstractIndexBackend
from sentry.utils.iterators import chunked
from sentry.utils.functional import apply_values
from sentry.utils.redis import load_script, with_future_responses


index = load_script('similarity/index.lua')


def banded(n, value):
    assert len(value) % n == 0
    return list(chunked(value, len(value) / n))


def flatten(value):
    return list(itertools.chain.from_iterable(value))


def avg(values):
    return sum(values) / float(len(values))


def scale_to_total(values):
    total = float(sum(values))
    return map(lambda value: value / total, values)


def get_manhattan_distance(this, that):
    return sum(abs(this.get(key, 0) - that.get(key, 0)) for key in set(this).union(that))


def get_similarity(this, that):
    if sum(map(len, this)) == 0 and sum(map(len, that)) == 0:
        return -1
    elif sum(map(len, this)) == 0 or sum(map(len, that)) == 0:
        return -2

    rescale = functools.partial(map, functools.partial(apply_values, scale_to_total))
    this = rescale(this)
    that = rescale(that)
    return avg(
        map(
            lambda (this, that): 1 - (get_manhattan_distance(this, that) / 2),
            zip(this, that)
        )
    )


class RedisMinHashIndexBackend(AbstractIndexBackend):
    def __init__(self, cluster, namespace, signature_builder,
                 bands, interval, retention, candidate_set_limit):
        self.cluster = cluster
        self.namespace = namespace
        self.signature_builder = signature_builder
        self.bands = bands
        self.interval = interval
        self.retention = retention
        self.candidate_set_limit = candidate_set_limit

        self.__frequency_key_structs = (
            struct.Struct('>B'),
            struct.Struct('>' + ('H' * int(self.signature_builder.columns / self.bands))),
        )

    def __pack_frequency_key(self, band, bucket):
        band_struct, bucket_struct = self.__frequency_key_structs
        return ''.join([
            band_struct.pack(band),
            bucket_struct.pack(*bucket),
        ])

    def __unpack_frequency_key(self, key):
        band_struct, bucket_struct = self.__frequency_key_structs
        band, = band_struct.unpack_from(key)
        bucket = bucket_struct.unpack_from(key, band_struct.size)
        return band, bucket

    def __convert_frequency_response(self, response):
        result = [{} for _ in range(self.bands)]
        for key, value in response.result().items():
            band, bucket = self.__unpack_frequency_key(key)
            result[band][bucket] = int(value)
        return result

    def __search(self, scope, parameters, timestamp, limit):
        time_series = range(
            int(timestamp / self.interval),
            int(timestamp / self.interval) + self.retention + 1,
        )

        def fetch_candidates(pipeline, (index, frequencies, threshold)):
            bands = [[] for _ in range(self.bands)]
            for band, buckets in enumerate(frequencies):
                for bucket in buckets.keys():
                    for time_index in time_series:
                        bands[band].append(
                            pipeline.smembers(
                                '{namespace}:{{{scope}}}:{index}:m:{time}:{coordinates}'.format(
                                    namespace=self.namespace,
                                    scope=scope,
                                    index=index,
                                    time=time_index,
                                    coordinates=self.__pack_frequency_key(band, bucket),
                                )
                            )
                        )
            return bands

        def collect_candidates((index, frequencies, threshold), results):
            candidates = Counter()
            for band, responses in enumerate(results):
                candidates.update(
                    reduce(
                        lambda candidates, response: candidates | set(response.result()),
                        responses,
                        set(),
                    )
                )

            candidates = candidates.most_common(limit)
            if threshold > 0:
                candidates = filter(
                    lambda (key, hits): hits >= threshold,
                    candidates,
                )

            return candidates

        def combine_candidates(candidates):
            results = defaultdict(list)
            for i, candidates in enumerate(candidates):
                for key, hits in candidates:
                    results[key].append(hits)

            return [key for key, hits in sorted(
                results.items(),
                key=lambda (key, hits): (
                    sum(hits) / len(hits) * -1,
                    len(hits) * -1,
                    key,
                ),
            )[:self.candidate_set_limit]]

        def fetch_frequencies(pipeline, parameters, keys):
            results = []
            for key in keys:
                results.append([
                    pipeline.hgetall(
                        '{namespace}:{{{scope}}}:{index}:f:{key}'.format(
                            namespace=self.namespace,
                            scope=scope,
                            index=index,
                            key=key,
                        )
                    ) for (index, frequencies, threshold) in parameters
                ])
            return results

        def calculate_similarity(parameters, frequencies):
            return map(
                lambda ((index, source_frequencies, threshold), candidate_frequencies): get_similarity(
                    source_frequencies,
                    candidate_frequencies,
                ),
                zip(
                    parameters,
                    map(self.__convert_frequency_response, frequencies),
                ),
            )

        with with_future_responses(self.cluster.pipeline()) as pipeline:
            results = map(
                functools.partial(fetch_candidates, pipeline),
                parameters,
            )
            pipeline.execute()

        candidates = combine_candidates(
            map(
                collect_candidates,
                parameters,
                results,
            ),
        )

        with with_future_responses(self.cluster.pipeline()) as pipeline:
            frequencies = fetch_frequencies(pipeline, parameters, candidates)
            pipeline.execute()

        score_replacements = {
            -1.0: None,  # both items don't have the feature (no comparison)
            -2.0: 0,     # one item doesn't have the feature (totally dissimilar)
        }

        def decode_search_result(result):
            key, scores = result
            return (
                key,
                map(
                    lambda score: score_replacements.get(score, score),
                    map(float, scores),
                )
            )

        def get_comparison_key(result):
            key, scores = result

            scores = filter(
                lambda score: score is not None,
                scores,
            )

            return (
                sum(scores) / len(scores) * -1,  # average score, descending
                len(scores) * -1,  # number of indexes with scores, descending
                key,  # lexicographical sort on key, ascending
            )

        return sorted(
            map(
                decode_search_result,
                zip(
                    candidates,
                    map(
                        functools.partial(calculate_similarity, parameters),
                        frequencies,
                    )
                ),
            ),
            key=get_comparison_key,
        )[:limit]

    def classify(self, scope, items, limit=None, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        return self.__search(
            scope,
            [
                (index, [
                    {tuple(bucket): 1} for bucket in banded(self.bands, self.signature_builder(features))
                ], thresholds) for index, thresholds, features in items
            ],
            timestamp,
            limit,
        )

    def compare(self, scope, key, items, limit=None, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        with with_future_responses(self.cluster.pipeline()) as pipeline:
            results = [
                pipeline.hgetall(
                    '{namespace}:{{{scope}}}:{index}:f:{key}'.format(
                        namespace=self.namespace,
                        scope=scope,
                        index=index,
                        key=key,
                    )
                ) for (index, threshold) in items
            ]
            pipeline.execute()

        return self.__search(
            scope,
            [
                (index, self.__convert_frequency_response(result), threshold)
                for (index, threshold), result in
                zip(items, results)
            ],
            timestamp,
            limit,
        )

    def record(self, scope, key, items, timestamp=None):
        if not items:
            return  # nothing to do

        if timestamp is None:
            timestamp = int(time.time())

        with with_future_responses(self.cluster.pipeline()) as pipeline:
            for index, features in items:
                signature = list(self.signature_builder(features))
                key_prefix = '{namespace}:{{{scope}}}:{index}'.format(
                    namespace=self.namespace,
                    scope=scope,
                    index=index,
                )
                for band, bucket in enumerate(banded(self.bands, signature)):
                    frequency_key = '{}:f:{}'.format(key_prefix, key)
                    pipeline.hincrby(
                        frequency_key,
                        self.__pack_frequency_key(band, bucket),
                        1,
                    )
                    pipeline.expireat(
                        frequency_key,
                        timestamp + (self.retention * self.interval),
                    )

                    time_series = range(
                        int(timestamp / self.interval),
                        int(timestamp / self.interval) + self.retention + 1,
                    )
                    for time_index in time_series:
                        membership_set_key = '{}:m:{}:{}'.format(
                            key_prefix,
                            time_index,
                            self.__pack_frequency_key(band, bucket),
                        )
                        pipeline.sadd(membership_set_key, key)
                        pipeline.expireat(
                            membership_set_key,
                            time_index * self.interval + (self.retention * self.interval),
                        )

            pipeline.execute()

    def merge(self, scope, destination, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        raise NotImplementedError

    def delete(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        with with_future_responses(self.cluster.pipeline()) as pipeline:
            results = []
            for index, key in items:
                key = '{namespace}:{{{scope}}}:{index}:f:{key}'.format(
                    namespace=self.namespace,
                    scope=scope,
                    index=index,
                    key=key,
                )
                results.append(pipeline.hgetall(key))
                pipeline.delete(key)
            pipeline.execute()

        results = map(
            self.__convert_frequency_response,
            results,
        )

        time_series = range(
            int(timestamp / self.interval),
            int(timestamp / self.interval) + self.retention + 1,
        )

        with with_future_responses(self.cluster.pipeline()) as pipeline:
            for (index, key), frequencies in zip(items, results):
                for band, buckets in enumerate(frequencies):
                    for bucket, count in buckets.items():
                        for time_index in time_series:
                            membership_set_key = '{namespace}:{{{scope}}}:{index}:m:{time}:{key}'.format(
                                namespace=self.namespace,
                                scope=scope,
                                index=index,
                                time=time_index,
                                key=self.__pack_frequency_key(band, bucket),
                            )
                            pipeline.srem(membership_set_key, key)
            pipeline.execute()

    def scan(self, scope, indices, batch=1000, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        raise NotImplementedError

    def flush(self, scope, indices, batch=1000, timestamp=None):
        raise NotImplementedError

    def export(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        raise NotImplementedError

    def import_(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        raise NotImplementedError


class RedisScriptMinHashIndexBackend(AbstractIndexBackend):
    def __init__(self, cluster, namespace, signature_builder,
                 bands, interval, retention, candidate_set_limit):
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
        for bucket in banded(self.bands, self.signature_builder(features)):
            arguments.extend([1, ','.join(map('{}'.format, bucket)), 1])
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
            -2.0: 0,     # one item doesn't have the feature (totally dissimilar)
        }

        def decode_search_result(result):
            key, scores = result
            return (
                key,
                map(
                    lambda score: score_replacements.get(score, score),
                    map(float, scores),
                )
            )

        def get_comparison_key(result):
            key, scores = result

            scores = filter(
                lambda score: score is not None,
                scores,
            )

            return (
                sum(scores) / len(scores) * -1,  # average score, descending
                len(scores) * -1,  # number of indexes with scores, descending
                key,  # lexicographical sort on key, ascending
            )

        return sorted(
            map(decode_search_result, results),
            key=get_comparison_key,
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
            'COMPARE',
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
            'RECORD',
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
            'MERGE',
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
            'DELETE',
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
            'SCAN',
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
            'EXPORT',
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
            'IMPORT',
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
