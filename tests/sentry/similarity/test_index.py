from __future__ import absolute_import

import time

import msgpack
from exam import fixture

from sentry.similarity.index import MinHashIndex
from sentry.similarity.signatures import MinHashSignatureBuilder
from sentry.testutils import TestCase
from sentry.utils import redis

signature_builder = MinHashSignatureBuilder(32, 0xFFFF)


class MinHashIndexTestCase(TestCase):
    @fixture
    def index(self):
        return MinHashIndex(
            redis.clusters.get('default'),
            'sim',
            signature_builder,
            16,
            60 * 60,
            12,
        )

    def test_basic(self):
        self.index.record('example', '1', [('index', 'hello world')])
        self.index.record('example', '2', [('index', 'hello world')])
        self.index.record('example', '3', [('index', 'jello world')])
        self.index.record('example', '4', [
            ('index', 'yellow world'),
            ('index', 'mellow world'),
        ])
        self.index.record('example', '5', [('index', 'pizza world')])

        results = self.index.compare('example', '1', ['index'])[0]
        assert results[0] == ('1', 1.0)
        assert results[1] == ('2', 1.0)  # identical contents
        assert results[2][0] in ('3', '4')  # equidistant pairs, order doesn't really matter
        assert results[3][0] in ('3', '4')
        assert results[4][0] == '5'

        results = self.index.classify('example', [('index', 'hello world')])[0]
        assert results[0:2] == [('1', 1.0), ('2', 1.0)]
        assert results[2][0] in ('3', '4')  # equidistant pairs, order doesn't really matter
        assert results[3][0] in ('3', '4')
        assert results[4][0] == '5'

        self.index.delete('example', [('index', '3')])
        assert [key for key, _ in self.index.compare('example', '1', ['index'])[0]] == [
            '1', '2', '4', '5'
        ]

        assert MinHashIndex(
            self.index.cluster,
            self.index.namespace + '2',
            self.index.signature_builder,
            self.index.bands,
            self.index.interval,
            self.index.retention,
        ).compare('example', '1', ['index']) == [[]]

    def test_merge(self):
        self.index.record('example', '1', [('index', ['foo', 'bar'])])
        self.index.record('example', '2', [('index', ['baz'])])
        assert self.index.classify('example', [('index', ['foo', 'bar'])])[0] == [
            ('1', 1.0),
        ]

        self.index.merge('example', '1', [('index', '2')])
        assert self.index.classify('example', [('index', ['foo', 'bar'])])[0] == [
            ('1', 0.5),
        ]

        # merge into an empty key should act as a move
        self.index.merge('example', '2', [('index', '1')])
        assert self.index.classify('example', [('index', ['foo', 'bar'])])[0] == [
            ('2', 0.5),
        ]

    def test_export_import(self):
        self.index.record('example', '1', [('index', 'hello world')])

        timestamp = int(time.time())
        result = self.index.export('example', [('index', 1)], timestamp=timestamp)
        assert len(result) == 1

        data = msgpack.unpackb(result[0])
        assert len(data) == self.index.bands

        for band in data:
            assert len(band) == (self.index.retention + 1)
            assert sum(
                sum(dict(bucket_frequencies).values()) for index, bucket_frequencies in band
            ) == 1

        # Copy the data from key 1 to key 2.
        self.index.import_('example', [('index', 2, result[0])], timestamp=timestamp)

        assert self.index.export(
            'example', [('index', 1)], timestamp=timestamp
        ) == self.index.export(
            'example', [('index', 2)], timestamp=timestamp
        )

        # Copy the data again to key 2 (duplicating all of the data.)
        self.index.import_('example', [('index', 2, result[0])], timestamp=timestamp)

        result = self.index.export('example', [('index', 2)], timestamp=timestamp)
        assert len(result) == 1

        data = msgpack.unpackb(result[0])
        assert len(data) == self.index.bands

        for band in data:
            assert len(band) == (self.index.retention + 1)
            assert sum(
                sum(dict(bucket_frequencies).values()) for index, bucket_frequencies in band
            ) == 2

    def test_flush_scoped(self):
        self.index.record('example', '1', [('index', ['foo', 'bar'])])
        assert self.index.classify('example', [('index', ['foo', 'bar'])])[0] == [
            ('1', 1.0),
        ]

        self.index.flush('example', ['index'])
        assert self.index.classify('example', [('index', ['foo', 'bar'])])[0] == []

    def test_flush_unscoped(self):
        self.index.record('example', '1', [('index', ['foo', 'bar'])])
        assert self.index.classify('example', [('index', ['foo', 'bar'])])[0] == [
            ('1', 1.0),
        ]

        self.index.flush('*', ['index'])
        assert self.index.classify('example', [('index', ['foo', 'bar'])])[0] == []
