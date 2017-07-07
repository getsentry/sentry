from __future__ import absolute_import

import itertools

from django.conf import settings

from sentry.utils import redis
from sentry.utils.datastructures import BidirectionalMapping
from sentry.utils.iterators import shingle

from sentry.similarity.index import MinHashIndex
from sentry.similarity.features import (
    FeatureSet,
    ExceptionFeature,
    MessageFeature,
    get_application_chunks,
)


def text_shingle(n, value):
    return itertools.imap(
        u''.join,
        shingle(n, value),
    )


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
    }
)
