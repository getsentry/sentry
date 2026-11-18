from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from typing import TYPE_CHECKING, cast

from django.conf import settings

from sentry import features as feature_flags
from sentry.interfaces.stacktrace import Frame
from sentry.similarity.backends.abstract import AbstractIndexBackend
from sentry.similarity.backends.dummy import DummyIndexBackend
from sentry.similarity.backends.metrics import MetricsWrapper
from sentry.similarity.backends.redis import Cluster, RedisScriptMinHashIndexBackend
from sentry.similarity.encoder import Encoder
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

if TYPE_CHECKING:
    from sentry.models.project import Project

logger = logging.getLogger(__name__)


def text_shingle(n: int, value: str) -> list[str]:
    return ["".join(part) for part in shingle(n, value)]


class FrameEncodingError(ValueError):
    pass


def get_frame_attributes(frame: Frame) -> dict[str, object]:
    attributes: dict[str, object] = {}

    if frame.function in {"<lambda>", None}:
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


def _make_index_backend(cluster: object, namespace: str = "sim:1") -> AbstractIndexBackend:
    if isinstance(cluster, str):
        cluster_id = cluster

        try:
            cluster = redis.redis_clusters.get(cluster_id)
        except KeyError:
            index = DummyIndexBackend()
            logger.info("No redis cluster provided for similarity, using %s.", repr(index))
            return index

    return MetricsWrapper(
        RedisScriptMinHashIndexBackend(
            cast("Cluster", cluster),
            namespace,
            MinHashSignatureBuilder(16, 0xFFFF),
            8,
            60 * 60 * 24 * 30,
            3,
            5000,
        ),
        scope_tag_name=None,
    )


features = FeatureSet(
    _make_index_backend(
        getattr(settings, "SENTRY_SIMILARITY_INDEX_REDIS_CLUSTER", None) or "similarity",
        namespace="sim:1",
    ),
    Encoder({Frame: get_frame_attributes}),
    cast(
        "Mapping[str, str]",
        BidirectionalMapping(
            {
                "exception:message:character-shingles": "a",
                "exception:stacktrace:application-chunks": "b",
                "exception:stacktrace:pairs": "c",
                "message:message:character-shingles": "d",
            }
        ),
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


def _build_dispatcher(methodname: str) -> Callable[..., None]:
    v1_method = getattr(features, methodname)

    def inner(project: Project | None, *args: object, **kwargs: object) -> None:
        if project is None or feature_flags.has("projects:similarity-indexing", project):
            v1_method(*args, **kwargs)

    inner.__name__ = methodname

    return inner


merge = _build_dispatcher("merge")
record = _build_dispatcher("record")
delete = _build_dispatcher("delete")
