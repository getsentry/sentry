from __future__ import absolute_import

import math

import pytest

from sentry.similarity import (
    MinHashIndex, get_exception_frames, get_euclidian_distance,
    get_manhattan_distance, get_number_format, get_frame_signature,
    scale_to_total, serialize_frame,
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
        {'a': 1},
        {'b': 1},
    ) == get_manhattan_distance(
        {'a': 1},
        {'b': 0.5, 'c': 0.5},
    ) == 2

    assert get_manhattan_distance(
        {'a': 1},
        {'a': 1, 'b': 1},
    ) == 1

    assert get_manhattan_distance(
        {'a': 1, 'b': 0},
        {'a': 0, 'b': 1},
    ) == 2

    assert get_manhattan_distance(
        {'a': 1},
        {'b': 1},
    ) == 2


def test_get_similarity():
    index = MinHashIndex(None, 0xFFFF, 1, 1)

    assert index.get_similarity(
        [{'a': 1}],
        [{'a': 0.5, 'b': 0.25, 'c': 0.25}],
    ) == 0.5

    assert index.get_similarity(
        [{'a': 1}],
        [{'b': 0.5, 'c': 0.5}],
    ) == 0

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


def test_get_number_format():
    assert get_number_format(0xFF).pack(0xFF) == '\xff'
    assert get_number_format(0xFF + 1).pack(0xFF) == '\x00\xff'

    assert get_number_format(0xFFFF).pack(0xFFFF) == '\xff\xff'
    assert get_number_format(0xFFFF + 1).pack(0xFFFF) == '\x00\x00\xff\xff'

    assert get_number_format(0xFFFFFFFF).pack(0xFFFFFFFF) == '\xff\xff\xff\xff'
    assert get_number_format(0xFFFFFFFF + 1).pack(0xFFFFFFFF) == '\x00\x00\x00\x00\xff\xff\xff\xff'

    assert get_number_format(0xFFFFFFFFFFFFFFFF).pack(0xFFFFFFFFFFFFFFFF) == '\xff\xff\xff\xff\xff\xff\xff\xff'

    with pytest.raises(ValueError):
        assert get_number_format(0xFFFFFFFFFFFFFFFF + 1)


def test_get_exception_frames():
    assert get_exception_frames({}) == []

    assert get_exception_frames({
        'stacktrace': None,
    }) == []

    assert get_exception_frames({
        'stacktrace': {},
    }) == []

    assert get_exception_frames({
        'stacktrace': {
            'frames': None,
        },
    }) == []

    assert get_exception_frames({
        'stacktrace': {
            'frames': 13,
        },
    }) == []


def test_serialize_frame():
    with pytest.raises(Exception):
        serialize_frame({})

    serialize_frame({
        'function': u'\N{SNOWMAN}',
    })

    serialize_frame({
        'module': u'\N{SNOWMAN WITHOUT SNOW}',
        'function': u'\N{SNOWMAN}',
    })

    serialize_frame({
        'filename': u'\N{BLACK SNOWMAN}',
        'function': u'\N{SNOWMAN}',
    })

    context = {
        'pre_context': ['foo'],
        'context_line': 'bar',
        'post_context': ['baz'],
    }

    assert serialize_frame(context) == \
        serialize_frame(dict({'function': '<lambda>'}, **context)) == \
        serialize_frame(dict({'function': None}, **context))

    assert serialize_frame({
        'pre_context': (['red'] * 10) + (['foo'] * 5),
        'context_line': 'bar',
        'post_context': (['foo'] * 5) + (['red'] * 10),
    }) == serialize_frame({
        'pre_context': (['blue'] * 10) + (['foo'] * 5),
        'context_line': 'bar',
        'post_context': (['foo'] * 5) + (['blue'] * 10),
    })

    with pytest.raises(Exception):
        serialize_frame({
            'pre_context': ['foo'],
            'post_context': ['baz'],
        })


def test_get_frame_signature():
    assert get_frame_signature({
        'context_line': 'bar'
    }) == get_frame_signature({
        'pre_context': None,
        'context_line': 'bar',
        'post_context': None,
    }) == get_frame_signature({
        'pre_context': [],
        'context_line': 'bar',
        'post_context': [],
    })

    get_frame_signature({
        'pre_context': ['foo'],
        'context_line': 'bar',
        'post_context': ['baz'],
    })

    get_frame_signature({
        'pre_context': [u'\N{SNOWMAN WITHOUT SNOW}'],
        'context_line': u'\N{SNOWMAN}',
        'post_context': [u'\N{BLACK SNOWMAN}'],
    })


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
        assert results[2][0] in ('3', '4')  # equidistant pairs, order doesn't really matter
        assert results[3][0] in ('3', '4')
        assert results[4][0] == '5'
