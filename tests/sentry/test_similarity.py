from __future__ import absolute_import

import pytest

from sentry.similarity import (
    MinHashIndex, get_exception_frames, get_frame_signature,
    serialize_frame,
)
from sentry.testutils import TestCase
from sentry.utils import redis


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
            60 * 60,
            12,
        )

        index.record('example', '1', [('index', 'hello world')])
        index.record('example', '2', [('index', 'hello world')])
        index.record('example', '3', [('index', 'jello world')])
        index.record('example', '4', [('index', 'yellow world')])
        index.record('example', '4', [('index', 'mellow world')])
        index.record('example', '5', [('index', 'pizza world')])

        results = index.query('example', '1', ['index'])[0]
        assert results[0] == ('1', 1.0)
        assert results[1] == ('2', 1.0)  # identical contents
        assert results[2][0] in ('3', '4')  # equidistant pairs, order doesn't really matter
        assert results[3][0] in ('3', '4')
        assert results[4][0] == '5'
