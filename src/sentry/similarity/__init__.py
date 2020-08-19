from __future__ import absolute_import

import logging

from django.conf import settings

from sentry.interfaces.stacktrace import Frame
from sentry.similarity.backends.dummy import DummyIndexBackend
from sentry.similarity.backends.metrics import MetricsWrapper
from sentry.similarity.backends.redis import RedisScriptMinHashIndexBackend
from sentry.similarity.encoder import Encoder
from sentry.similarity.features import (
    ExceptionFeature,
    FeatureSet,
    InterfaceDoesNotExist,
    MessageFeature,
    get_application_chunks,
)
from sentry.similarity.featuresv2 import GroupingBasedFeatureSet
from sentry.similarity.signatures import MinHashSignatureBuilder
from sentry.utils import redis
from sentry.utils.compat import map
from sentry.utils.datastructures import BidirectionalMapping
from sentry.utils.iterators import shingle

logger = logging.getLogger(__name__)


def text_shingle(n, value):
    return map(u"".join, shingle(n, value))


class FrameEncodingError(ValueError):
    pass


def get_frame_attributes(frame):
    attributes = {}

    if frame.function in set(["<lambda>", None]):
        if frame.context_line is None:
            raise FrameEncodingError(
                "Cannot create a signature for frame without a `context_line` value."
            )

        attributes["signature"] = (
            (frame.pre_context or [])[-5:] + [frame.context_line] + (frame.post_context or [])[:5]
        )
    else:
        attributes["function"] = frame.function

    for name in ("module", "filename"):
        value = getattr(frame, name)
        if value:
            attributes[name] = value
            break
    else:
        raise FrameEncodingError("Cannot encode a frame without a `module` or `filename` value.")

    return attributes


def _make_index_backend(cluster=None, namespace="sim:1"):
    if not cluster:
        cluster_id = getattr(settings, "SENTRY_SIMILARITY_INDEX_REDIS_CLUSTER", "similarity")

        try:
            cluster = redis.redis_clusters.get(cluster_id)
        except KeyError:
            index = DummyIndexBackend()
            logger.info(u"No redis cluster provided for similarity, using {!r}.".format(index))
            return index

    return MetricsWrapper(
        RedisScriptMinHashIndexBackend(
            cluster, namespace, MinHashSignatureBuilder(16, 0xFFFF), 8, 60 * 60 * 24 * 30, 3, 5000
        ),
        scope_tag_name=None,
    )


features = FeatureSet(
    _make_index_backend(namespace="sim:1"),
    Encoder({Frame: get_frame_attributes}),
    BidirectionalMapping(
        {
            "exception:message:character-shingles": "a",
            "exception:stacktrace:application-chunks": "b",
            "exception:stacktrace:pairs": "c",
            "message:message:character-shingles": "d",
        }
    ),
    {
        "exception:message:character-shingles": ExceptionFeature(
            lambda exception: text_shingle(5, exception.value)
        ),
        "exception:stacktrace:application-chunks": ExceptionFeature(
            lambda exception: get_application_chunks(exception)
        ),
        "exception:stacktrace:pairs": ExceptionFeature(
            lambda exception: shingle(2, exception.stacktrace.frames)
        ),
        "message:message:character-shingles": MessageFeature(
            lambda message: text_shingle(5, message.formatted)
        ),
    },
    expected_extraction_errors=(InterfaceDoesNotExist,),
    expected_encoding_errors=(FrameEncodingError,),
)

features2 = GroupingBasedFeatureSet(_make_index_backend(namespace="sim:2"))
