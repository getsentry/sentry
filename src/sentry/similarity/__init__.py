from __future__ import absolute_import

from django.conf import settings

from sentry.similarity.features import (
    ExceptionFeature,
    MessageFeature,
    FeatureSet,
    get_application_chunks,
    get_exception_frames,
    serialize_frame,
    serialize_text_shingle,
)
from sentry.similarity.index import MinHashIndex
from sentry.utils import redis
from sentry.utils.datastructures import BidirectionalMapping
from sentry.utils.iterators import shingle


FRAME_SEPARATOR = b'\x02'


features = FeatureSet(
    MinHashIndex(
        redis.clusters.get(
            getattr(
                settings,
                'SENTRY_SIMILARITY_INDEX_REDIS_CLUSTER',
                'default',
            ),
        ),
        0xFFFF,
        8,
        2,
        60 * 60 * 24 * 30,
        3,
    ),
    BidirectionalMapping({
        'exception:message:character-shingles': 'a',
        'exception:stacktrace:application-chunks': 'b',
        'exception:stacktrace:pairs': 'c',
        'message:message:character-shingles': 'd',
    }),
    {
        'exception:message:character-shingles': ExceptionFeature(
            lambda exception: map(
                serialize_text_shingle,
                shingle(
                    13,
                    exception.get('value') or '',
                ),
            )
        ),
        'exception:stacktrace:application-chunks': ExceptionFeature(
            lambda exception: map(
                lambda frames: FRAME_SEPARATOR.join(
                    map(
                        serialize_frame,
                        frames,
                    ),
                ),
                get_application_chunks(exception),
            ),
        ),
        'exception:stacktrace:pairs': ExceptionFeature(
            lambda exception: map(
                FRAME_SEPARATOR.join,
                shingle(
                    2,
                    map(
                        serialize_frame,
                        get_exception_frames(exception),
                    ),
                ),
            ),
        ),
        'message:message:character-shingles': MessageFeature(
            lambda message: map(
                serialize_text_shingle,
                shingle(
                    13,
                    message['message'],
                ),
            ),
        ),
    }
)
