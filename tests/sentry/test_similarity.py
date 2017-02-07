from __future__ import absolute_import

import math

import pytest

from sentry.similarity import (
    MinHashIndex, get_euclidian_distance, get_manhattan_distance,
    get_number_formatter, scale_to_total
)
from sentry.testutils import TestCase
from sentry.utils import redis


def test_get_euclidian_distance():
    assert get_euclidian_distance({}, {}) == 0

    assert get_euclidian_distance(
        {'a': 1},
        {'a': 1},
    ) == 0

    assert get_euclidian_distance(
        {'a': 1, 'b': 0},
        {'a': 0, 'b': 1},
    ) == math.sqrt(2)

    assert get_euclidian_distance(
        {'a': 1},
        {'b': 1},
    ) == math.sqrt(2)


def test_get_manhattan_distance():
    assert get_manhattan_distance({}, {}) == 0

    assert get_manhattan_distance(
        {'a': 1},
        {'a': 1},
    ) == 0

    assert get_manhattan_distance(
        {'a': 1, 'b': 0},
        {'a': 0, 'b': 1},
    ) == 2

    assert get_manhattan_distance(
        {'a': 1},
        {'b': 1},
    ) == 2


def test_get_similarity():
    index = MinHashIndex(None, 0xFFFF, 2, 1)

    assert index.get_similarity(
        [
            {'a': 1},
            {'a': 1},
        ],
        [
            {'a': 1},
            {'a': 1},
        ],
    ) == 1.0

    assert index.get_similarity(
        [
            {'a': 1},
            {'a': 1},
        ],
        [
            {'b': 1},
            {'b': 1},
        ],
    ) == 0

    assert index.get_similarity(
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
        assert index.get_similarity(
            range(10),
            range(10),
        )

    with pytest.raises(AssertionError):
        assert index.get_similarity(
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


def test_get_number_formatter():
    assert get_number_formatter(0xFF)(0xFF) == '\xff'
    assert get_number_formatter(0xFF + 1)(0xFF) == '\x00\xff'

    assert get_number_formatter(0xFFFF)(0xFFFF) == '\xff\xff'
    assert get_number_formatter(0xFFFF + 1)(0xFFFF) == '\x00\x00\xff\xff'

    assert get_number_formatter(0xFFFFFFFF)(0xFFFFFFFF) == '\xff\xff\xff\xff'
    assert get_number_formatter(0xFFFFFFFF + 1)(0xFFFFFFFF) == '\x00\x00\x00\x00\xff\xff\xff\xff'

    assert get_number_formatter(0xFFFFFFFFFFFFFFFF)(0xFFFFFFFFFFFFFFFF) == '\xff\xff\xff\xff\xff\xff\xff\xff'

    with pytest.raises(ValueError):
        assert get_number_formatter(0xFFFFFFFFFFFFFFFF + 1)


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
