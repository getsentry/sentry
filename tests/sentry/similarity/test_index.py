from __future__ import absolute_import

import time

import msgpack

from sentry.similarity.index import MinHashIndex
from sentry.similarity.signatures import MinHashSignatureBuilder
from sentry.testutils import TestCase
from sentry.utils import redis


signature_builder = MinHashSignatureBuilder(16, 0xFFFF)


class MinHashIndexTestCase(TestCase):
    def test_index(self):
        index = MinHashIndex(
            redis.clusters.get('default'),
            'sim',
            signature_builder,
            8,
            60 * 60,
            12,
        )

        index.record('example', '1', [('index', 'hello world')])
        index.record('example', '2', [('index', 'hello world')])
        index.record('example', '3', [('index', 'jello world')])
        index.record('example', '4', [('index', 'yellow world')])
        index.record('example', '4', [('index', 'mellow world')])
        index.record('example', '5', [('index', 'pizza world')])

        results = index.compare('example', '1', ['index'])[0]
        assert results[0] == ('1', 1.0)
        assert results[1] == ('2', 1.0)  # identical contents
        assert results[2][0] in ('3', '4')  # equidistant pairs, order doesn't really matter
        assert results[3][0] in ('3', '4')
        assert results[4][0] == '5'

        index.delete('example', [('index', '3')])
        assert [key for key, _ in index.compare('example', '1', ['index'])[0]] == [
            '1', '2', '4', '5'
        ]

        assert MinHashIndex(
            redis.clusters.get('default'),
            'sim2',
            signature_builder,
            8,
            60 * 60,
            12,
        ).query('example', '1', ['index']) == [[]]

    def test_export_import(self):
        retention = 12
        index = MinHashIndex(
            redis.clusters.get('default'),
            'sim',
            signature_builder,
            8,
            60 * 60,
            retention,
        )

        index.record('example', '1', [('index', 'hello world')])

        timestamp = int(time.time())
        result = index.export('example', [('index', 1)], timestamp=timestamp)
        assert len(result) == 1

        data = msgpack.unpackb(result[0])
        assert len(data) == index.bands

        for band in data:
            assert len(band) == (retention + 1)
            assert sum(sum(dict(bucket_frequencies).values())
                       for index, bucket_frequencies in band) == 1

        # Copy the data from key 1 to key 2.
        index.import_('example', [('index', 2, result[0])], timestamp=timestamp)

        assert index.export(
            'example',
            [('index', 1)],
            timestamp=timestamp
        ) == index.export(
            'example',
            [('index', 2)],
            timestamp=timestamp
        )

        # Copy the data again to key 2 (duplicating all of the data.)
        index.import_('example', [('index', 2, result[0])], timestamp=timestamp)

        result = index.export('example', [('index', 2)], timestamp=timestamp)
        assert len(result) == 1

        data = msgpack.unpackb(result[0])
        assert len(data) == index.bands

        for band in data:
            assert len(band) == (retention + 1)
            assert sum(sum(dict(bucket_frequencies).values())
                       for index, bucket_frequencies in band) == 2
