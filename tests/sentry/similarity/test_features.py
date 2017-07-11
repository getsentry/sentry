from __future__ import absolute_import

import pytest

from sentry.models import Event
from sentry.similarity.features import (
    ExceptionFeature, InsufficientContext, get_exception_frames,
    get_frame_signature, serialize_frame
)


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

    with pytest.raises(InsufficientContext):
        get_frame_signature({})

    with pytest.raises(InsufficientContext):
        get_frame_signature({
            'pre_context': ['pre'],
            'post_context': ['post'],
        })


def test_exception_feature():
    good_frame = {
        'function': 'name',
        'module': 'module',
    }

    bad_frame = {}

    assert serialize_frame(good_frame)
    with pytest.raises(InsufficientContext):
        serialize_frame(bad_frame)

    feature = ExceptionFeature(
        lambda exception: map(
            serialize_frame,
            get_exception_frames(exception),
        ),
    )

    def build_event(frames):
        return Event(
            data={
                'sentry.interfaces.Exception': {
                    'values': [
                        {
                            'stacktrace': {
                                'frames': frames,
                            },
                        },
                    ],
                },
            },
        )

    assert list(
        feature.extract(
            build_event([
                good_frame,
            ]),
        )
    ) == [
        [serialize_frame(good_frame)],
    ]

    assert list(
        feature.extract(
            build_event([
                good_frame,
                bad_frame,
            ]),
        )
    ) == []
