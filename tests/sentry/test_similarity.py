from __future__ import absolute_import

import math

import pytest

from sentry.similarity import MinHashIndex, get_distance, get_similarity, scale_to_total
from sentry.testutils import TestCase
from sentry.utils import redis


def test_get_distance():
    assert get_distance({}, {}) == 0

    assert get_distance(
        {'a': 1},
        {'a': 1},
    ) == 0

    assert get_distance(
        {'a': 1, 'b': 0},
        {'a': 0, 'b': 1},
    ) == math.sqrt(2)

    assert get_distance(
        {'a': 1},
        {'b': 1},
    ) == math.sqrt(2)


def test_get_similarity():
    assert get_similarity(
        [{'a': 1}],
        [{'a': 1}],
    ) == 1.0

    assert get_similarity(
        [
            {'a': 1},
            {'a': 1},
        ],
        [
            {'a': 1},
            {'a': 1},
        ],
    ) == 1.0

    assert get_similarity(
        [
            {'a': 1},
            {'a': 1},
        ],
        [
            {'b': 1},
            {'b': 1},
        ],
    ) == 0

    assert get_similarity(
        [
            {'a': 1},
            {'b': 1},
        ],
        [
            {'b': 1},
            {'b': 1},
        ],
    ) == 0.5

    with pytest.raises(AssertionError):
        assert get_similarity(
            range(1),
            range(10),
        )


def test_scale_to_total():
    assert scale_to_total({}) == {}

    assert scale_to_total({
        'a': 10,
        'b': 10,
    }) == {
        'a': 0.5,
        'b': 0.5,
    }


class MinHashIndexTestCase(TestCase):
    def test_index(self):
        index = MinHashIndex(
            redis.clusters.get('default'),
            0xFFFF,
            8,
            2,
        )

        index.record('example', '1', 'hello world')
        index.record('example', '2', 'hello world')
        index.record('example', '3', 'jello world')
        index.record('example', '4', 'yellow world')
        index.record('example', '4', 'mellow world')
        index.record('example', '5', 'pizza world')

        results = index.query('example', '1')
        assert results[0] == ('1', 1.0)
        assert results[1] == ('2', 1.0)  # identical contents
        assert results[2][0] == '3'
        assert results[3][0] == '4'
        assert results[4][0] == '5'
