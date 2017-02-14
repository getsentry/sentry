from __future__ import absolute_import

import itertools
import logging
import math
import operator
import struct
from collections import Sequence

import mmh3
from django.conf import settings

from sentry.utils import redis
from sentry.utils.datastructures import BidirectionalMapping
from sentry.utils.iterators import shingle


logger = logging.getLogger(__name__)


def scale_to_total(value):
    """\
    Convert a mapping of distinct quantities to a mapping of proportions of the
    total quantity.
    """
    total = float(sum(value.values()))
    return {k: (v / total) for k, v in value.items()}


def get_euclidian_distance(target, other):
    """\
    Calculate the N-dimensional Euclidian between two mappings.

    The mappings are used to represent sparse arrays -- if a key is not present
    in both mappings, it's assumed to be 0 in the mapping where it is missing.
    """
    return math.sqrt(
        sum(
            (target.get(k, 0) - other.get(k, 0)) ** 2
            for k in set(target) | set(other)
        )
    )


def get_manhattan_distance(target, other):
    """\
    Calculate the N-dimensional Manhattan distance between two mappings.

    The mappings are used to represent sparse arrays -- if a key is not present
    in both mappings, it's assumed to be 0 in the mapping where it is missing.

    The result of this function will be expressed as the distance between the
    caller and a 5:2 ratio of rye whiskey to sweet Italian vermouth, with a
    dash of bitters.
    """
    return sum(
        abs(target.get(k, 0) - other.get(k, 0))
        for k in set(target) | set(other)
    )


formats = sorted([
    (2 ** 8 - 1, 'B'),
    (2 ** 16 - 1, 'H'),
    (2 ** 32 - 1, 'L'),
    (2 ** 64 - 1, 'Q'),
])


def get_number_format(size, width=1):
    """\
    Returns a ``Struct`` object that can be used packs (and unpack) a number no
    larger than the provided size into to an efficient binary representation.
    """
    assert size > 0

    for maximum, format in formats:
        if maximum >= size:
            return struct.Struct('>%s' % (format * width))

    raise ValueError('No registered formatter can handle the provided value.')


class MinHashIndex(object):
    """\
    Implements an index that can be used to efficiently search for items that
    share similar characteristics.

    This implementation is based on MinHash (which is used quickly identify
    similar items and estimate the Jaccard similarity of their characteristic
    sets) but this implementation extends the typical design to add the ability
    to record items by an arbitrary key. This allows querying for similar
    groups that contain many different characteristic sets.

    The ``rows`` parameter is the size of the hash ring used to collapse the
    domain of all tokens to a fixed-size range. The total size of the LSH
    signature is ``bands * buckets``. These attributes control the distribution
    of data within the index, and modifying them after data has already been
    written will cause data loss and/or corruption.

    This is modeled as two data structures:

    - A bucket frequency sorted set, which maintains a count of what buckets
      have been recorded -- and how often -- in a ``(band, key)`` pair. This
      data can be used to identify what buckets a key is a member of, and also
      used to identify the degree of bucket similarity when comparing with data
      associated with another key.
    - A bucket membership set, which maintains a record of what keys have been
      record in a ``(band, bucket)`` pair. This data can be used to identify
      what other keys may be similar to the lookup key (but not the degree of
      similarity.)
    """
    BUCKET_MEMBERSHIP = b'\x00'
    BUCKET_FREQUENCY = b'\x01'

    def __init__(self, cluster, rows, bands, buckets):
        self.namespace = b'sim'

        self.cluster = cluster
        self.rows = rows

        sequence = itertools.count()
        self.bands = [[next(sequence) for j in xrange(buckets)] for i in xrange(bands)]

        self.__band_format = get_number_format(bands)
        self.__bucket_format = get_number_format(rows, buckets)

    def get_signature(self, value):
        """Generate a signature for a value."""
        return map(
            lambda band: map(
                lambda bucket: min(
                    map(
                        lambda item: mmh3.hash(item, bucket) % self.rows,
                        value,
                    ),
                ),
                band,
            ),
            self.bands,
        )

    def get_similarity(self, target, other):
        """\
        Calculate the degree of similarity between two bucket frequency
        sequences which represent two different keys.

        This is mainly an implementation detail for sorting query results, but
        is exposed publically for testing. This method assumes all input
        values have already been normalized using ``scale_to_total``.
        """
        assert len(target) == len(other)
        assert len(target) == len(self.bands)
        return sum(
            map(
                lambda (left, right): 1 - (
                    get_manhattan_distance(
                        left,
                        right,
                    ) / 2.0
                ),
                zip(target, other)
            )
        ) / len(target)

    def query(self, scope, key):
        """\
        Find other entries that are similar to the one repesented by ``key``.

        This returns an sequence of ``(key, estimated similarity)`` pairs,
        where a similarity score of 1 is completely similar, and a similarity
        score of 0 is completely dissimilar. The result sequence is ordered
        from most similar to least similar. (For example, the search key itself
        isn't filtered from the result and will always have a similarity of 1,
        typically making it the first result.)
        """
        def fetch_bucket_frequencies(keys):
            """Fetch the bucket frequencies for each band for each provided key."""
            with self.cluster.map() as client:
                responses = {
                    key: map(
                        lambda band: client.zrange(
                            b'{}:{}:{}:{}:{}'.format(
                                self.namespace,
                                scope,
                                self.BUCKET_FREQUENCY,
                                self.__band_format.pack(band),
                                key,
                            ),
                            0,
                            -1,
                            desc=True,
                            withscores=True,
                        ),
                        range(len(self.bands)),
                    ) for key in keys
                }

            result = {}
            for key, promises in responses.items():
                # Resolve each promise, and scale the number of observations
                # for each bucket to [0,1] value (the proportion of items
                # observed in that band that belong to the bucket for the key.)
                result[key] = map(
                    lambda promise: scale_to_total({
                        self.__bucket_format.unpack(k): v for k, v in promise.value
                    }),
                    promises,
                )

            return result

        def fetch_candidates(signature):
            """Fetch all the similar candidates for a given signature."""
            with self.cluster.map() as client:
                responses = map(
                    lambda (band, buckets): map(
                        lambda bucket: client.smembers(
                            b'{}:{}:{}:{}:{}'.format(
                                self.namespace,
                                scope,
                                self.BUCKET_MEMBERSHIP,
                                self.__band_format.pack(band),
                                self.__bucket_format.pack(*bucket),
                            )
                        ),
                        buckets,
                    ),
                    enumerate(signature),
                )

            # Resolve all of the promises for each band and reduce them into a
            # single set per band.
            return map(
                lambda band: reduce(
                    lambda values, promise: values | promise.value,
                    band,
                    set(),
                ),
                responses,
            )

        target_frequencies = fetch_bucket_frequencies([key])[key]

        # Flatten the results of each band into a single set. (In the future we
        # might want to change this to only calculate the similarity for keys
        # that show up in some threshold number of bands.)
        candidates = reduce(
            lambda total, band: total | band,
            fetch_candidates(target_frequencies),
            set(),
        )

        return sorted(
            map(
                lambda (key, candidate_frequencies): (
                    key,
                    self.get_similarity(
                        target_frequencies,
                        candidate_frequencies,
                    ),
                ),
                fetch_bucket_frequencies(candidates).items(),
            ),
            key=lambda (key, similarity): (similarity * -1, key),
        )

    def record_multi(self, items):
        """\
        Records the presence of a set of characteristics within a group for a
        batch of items. Each item should be represented by a 3-tuple of
        ``(scope, key, characteristics)``.
        """
        with self.cluster.map() as client:
            for scope, key, characteristics in items:
                for band, buckets in enumerate(self.get_signature(characteristics)):
                    buckets = self.__bucket_format.pack(*buckets)
                    client.sadd(
                        b'{}:{}:{}:{}:{}'.format(
                            self.namespace,
                            scope,
                            self.BUCKET_MEMBERSHIP,
                            self.__band_format.pack(band),
                            buckets,
                        ),
                        key,
                    )
                    client.zincrby(
                        b'{}:{}:{}:{}:{}'.format(
                            self.namespace,
                            scope,
                            self.BUCKET_FREQUENCY,
                            self.__band_format.pack(band),
                            key,
                        ),
                        buckets,
                        1,
                    )

    def record(self, scope, key, characteristics):
        """Records the presence of a set of characteristics within a group."""
        return self.record_multi([
            (scope, key, characteristics),
        ])


FRAME_ITEM_SEPARATOR = b'\x00'
FRAME_PAIR_SEPARATOR = b'\x01'
FRAME_SEPARATOR = b'\x02'

FRAME_FUNCTION_KEY = b'\x10'
FRAME_MODULE_KEY = b'\x11'
FRAME_FILENAME_KEY = b'\x12'
FRAME_SIGNATURE_KEY = b'\x13'


def get_frame_signature(frame, lines=5):
    """\
    Creates a "signature" for a frame from the surrounding context lines,
    reading up to ``lines`` values from each side.
    """
    return struct.pack(
        '>i',
        mmh3.hash(
            u'\n'.join(
                (frame.get('pre_context') or [])[-lines:] +
                [frame['context_line']] +
                (frame.get('post_context') or [])[:lines]
            ).encode('utf8')
        ),
    )


def serialize_frame(frame):
    """\
    Convert a frame value from a ``Stacktrace`` interface into a bytes object.
    """
    # TODO(tkaemming): This should likely result in an intermediate data
    # structure that is easier to introspect than this one, and a separate
    # serialization step before hashing.
    # TODO(tkaemming): These frame values need platform-specific normalization.
    # This probably should be done prior to this method being called...?
    attributes = {}

    function_name = frame.get('function')
    if function_name in set(['<lambda>', None]):
        attributes[FRAME_SIGNATURE_KEY] = get_frame_signature(frame)
    else:
        attributes[FRAME_FUNCTION_KEY] = function_name.encode('utf8')

    scopes = (
        (FRAME_MODULE_KEY, 'module'),
        (FRAME_FILENAME_KEY, 'filename'),
    )

    for key, name in scopes:
        value = frame.get(name)
        if value:
            attributes[key] = value.encode('utf8')
            break

    return FRAME_ITEM_SEPARATOR.join(
        map(
            FRAME_PAIR_SEPARATOR.join,
            attributes.items(),
        ),
    )


def get_exception_frames(exception):
    """\
    Extracts frames from an ``Exception`` interface, returning an empty
    sequence if no frame value was provided or if the value is of an invalid or
    unexpected type.
    """
    try:
        frames = exception['stacktrace']['frames']
    except (TypeError, KeyError):
        logger.info('Could not extract frames from exception, returning empty sequence.', exc_info=True)
        frames = []
    else:
        if not isinstance(frames, Sequence):
            logger.info('Expected frames to be a sequence but got %r, returning empty sequence instead.', type(frames))
            frames = []

    return frames


def get_application_chunks(exception):
    """\
    Filters out system and framework frames from a stacktrace in order to
    better align similar logical application paths. This returns a sequence of
    application code "chunks": blocks of contiguously called application code.
    """
    return map(
        lambda (in_app, frames): list(frames),
        itertools.ifilter(
            lambda (in_app, frames): in_app,
            itertools.groupby(
                get_exception_frames(exception),
                key=lambda frame: frame.get('in_app', False),
            )
        )
    )


class ExceptionFeature(object):
    def __init__(self, function):
        self.function = function

    def extract(self, event):
        try:
            exceptions = event.data['sentry.interfaces.Exception']['values']
        except KeyError as error:
            logger.info('Could not extract characteristic(s) from %r due error: %r', event, error, exc_info=True)
            return

        for exception in exceptions:
            try:
                yield self.function(exception)
            except Exception as error:
                logger.exception('Could not extract characteristic(s) from exception in %r due to error: %r', event, error)


class MessageFeature(object):
    def __init__(self, function):
        self.function = function

    def extract(self, event):
        try:
            message = event.data['sentry.interfaces.Message']
        except KeyError as error:
            logger.info('Could not extract characteristic(s) from %r due error: %r', event, error, exc_info=True)
            return

        try:
            yield self.function(message)
        except Exception as error:
            logger.exception('Could not extract characteristic(s) from message of %r due to error: %r', event, error)


class FeatureSet(object):
    def __init__(self, index, aliases, features):
        self.index = index
        self.aliases = aliases
        self.features = features
        self.__number_format = get_number_format(0xFFFFFFFF)
        assert set(self.aliases) == set(self.features)

    def record(self, event):
        items = []
        for label, feature in self.features.items():
            alias = self.aliases[label]
            scope = ':'.join((
                alias,
                self.__number_format.pack(event.project_id),
            ))
            for characteristics in feature.extract(event):
                if characteristics:
                    items.append((
                        scope,
                        self.__number_format.pack(event.group_id),
                        characteristics,
                    ))
        return self.index.record_multi(items)

    def query(self, group):
        results = {}
        key = self.__number_format.pack(group.id)
        for label in self.features.keys():
            alias = self.aliases[label]
            scope = ':'.join((
                alias,
                self.__number_format.pack(group.project_id)
            ))
            results[label] = map(
                lambda (id, score): (
                    self.__number_format.unpack(id)[0],
                    score,
                ),
                self.index.query(scope, key)
            )
        return results


def serialize_text_shingle(value, separator=b''):
    """\
    Convert a sequence of Unicode strings into a bytes object.
    """
    return separator.join(
        map(
            operator.methodcaller('encode', 'utf8'),
            value,
        ),
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
    ),
    BidirectionalMapping({
        'exception:message:character-shingles': '\x00',
        'exception:stacktrace:application-chunks': '\x01',
        'exception:stacktrace:pairs': '\x02',
        'message:message:character-shingles': '\x03',
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
