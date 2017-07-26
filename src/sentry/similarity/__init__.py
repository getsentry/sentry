from __future__ import absolute_import

import itertools

from django.conf import settings

from sentry.interfaces.stacktrace import Frame
from sentry.similarity.encoder import Encoder
from sentry.similarity.index import MinHashIndex
from sentry.similarity.features import (
    ExceptionFeature,
    FeatureSet,
    InterfaceDoesNotExist,
    MessageFeature,
    get_application_chunks,
)
from sentry.similarity.signatures import MinHashSignatureBuilder
from sentry.utils import redis
from sentry.utils.datastructures import BidirectionalMapping
from sentry.utils.iterators import shingle


def text_shingle(n, value):
    return itertools.imap(
        u''.join,
        shingle(n, value),
    )


class FrameEncodingError(ValueError):
    pass


def get_frame_attributes(frame):
    attributes = {}

    if frame.function in set(['<lambda>', None]):
        if frame.context_line is None:
            raise FrameEncodingError(
                'Cannot create a signature for frame without a `context_line` value.'
            )

        attributes['signature'] = (
            (frame.pre_context or [])[-5:] + [frame.context_line] + (frame.post_context or [])[:5]
        )
    else:
        attributes['function'] = frame.function

    for name in ('module', 'filename'):
        value = getattr(frame, name)
        if value:
            attributes[name] = value
            break
    else:
        raise FrameEncodingError('Cannot encode a frame without a `module` or `filename` value.')

    return attributes


features = FeatureSet(
    MinHashIndex(
        redis.clusters.get(
            getattr(
                settings,
                'SENTRY_SIMILARITY_INDEX_REDIS_CLUSTER',
                'default',
            ),
        ),
        'sim:1',
        MinHashSignatureBuilder(16, 0xFFFF),
        8,
        60 * 60 * 24 * 30,
        3,
    ),
    Encoder({
        Frame: get_frame_attributes,
    }),
    BidirectionalMapping({
        'exception:message:character-shingles': 'a',
        'exception:stacktrace:application-chunks': 'b',
        'exception:stacktrace:pairs': 'c',
        'message:message:character-shingles': 'd',
    }),
    {
        'exception:message:character-shingles': ExceptionFeature(
            lambda exception: text_shingle(
                13,
                exception.value,
            ),
        ),
        'exception:stacktrace:application-chunks': ExceptionFeature(
            lambda exception: get_application_chunks(exception),
        ),
        'exception:stacktrace:pairs': ExceptionFeature(
            lambda exception: shingle(
                2,
                exception.stacktrace.frames,
            ),
        ),
        'message:message:character-shingles': MessageFeature(
            lambda message: text_shingle(
                13,
                message.message,
            ),
        ),
    },
    expected_extraction_errors=(
        InterfaceDoesNotExist,
    ),
    expected_encoding_errors=(
        FrameEncodingError,
    ),
)
