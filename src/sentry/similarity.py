from __future__ import absolute_import

import itertools
import logging
import operator
import struct
import time
from collections import Sequence

import mmh3
from django.conf import settings

from sentry.utils import redis
from sentry.utils.datastructures import BidirectionalMapping
from sentry.utils.dates import to_timestamp
from sentry.utils.iterators import shingle
from sentry.utils.redis import load_script


index = load_script('similarity/index.lua')


logger = logging.getLogger('sentry.similarity')


class MinHashIndex(object):
    def __init__(self, cluster, rows, bands, buckets, interval, retention):
        self.cluster = cluster
        self.rows = rows

        sequence = itertools.count()
        self.bands = [[next(sequence) for j in xrange(buckets)] for i in xrange(bands)]
        self.buckets = buckets
        self.interval = interval
        self.retention = retention

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

    def query(self, scope, key, indices, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'QUERY',
            timestamp,
            len(self.bands),
            self.interval,
            self.retention,
            scope,
            key,
        ]

        arguments.extend(indices)

        return [
            [(item, float(score)) for item, score in result]
            for result in
            index(
                self.cluster.get_local_client_for_key(scope),
                [],
                arguments,
            )
        ]

    def record(self, scope, key, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'RECORD',
            timestamp,
            len(self.bands),
            self.interval,
            self.retention,
            scope,
            key,
        ]

        for idx, features in items:
            arguments.append(idx)
            arguments.extend([','.join(map('{}'.format, band)) for band in self.get_signature(features)])

        return index(
            self.cluster.get_local_client_for_key(scope),
            [],
            arguments,
        )

    def merge(self, scope, destination, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'MERGE',
            timestamp,
            len(self.bands),
            self.interval,
            self.retention,
            scope,
            destination,
        ]

        for idx, source in items:
            arguments.extend([idx, source])

        return index(
            self.cluster.get_local_client_for_key(scope),
            [],
            arguments,
        )

    def delete(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'DELETE',
            timestamp,
            len(self.bands),
            self.interval,
            self.retention,
            scope,
        ]

        for idx, key in items:
            arguments.extend([idx, key])

        return index(
            self.cluster.get_local_client_for_key(scope),
            [],
            arguments,
        )

    def export(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'EXPORT',
            timestamp,
            len(self.bands),
            self.interval,
            self.retention,
            scope,
        ]

        for idx, key in items:
            arguments.extend([idx, key])

        return index(
            self.cluster.get_local_client_for_key(scope),
            [],
            arguments,
        )

    def import_(self, scope, items, timestamp=None):
        if timestamp is None:
            timestamp = int(time.time())

        arguments = [
            'IMPORT',
            timestamp,
            len(self.bands),
            self.interval,
            self.retention,
            scope,
        ]

        for idx, key, data in items:
            arguments.extend([idx, key, data])

        return index(
            self.cluster.get_local_client_for_key(scope),
            [],
            arguments,
        )


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
            logger.info('Could not extract characteristic(s) from %r due to error: %r', event, error, exc_info=True)
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
            logger.info('Could not extract characteristic(s) from %r due to error: %r', event, error, exc_info=True)
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
        assert set(self.aliases) == set(self.features)

    def __get_scope(self, group):
        return '{}'.format(group.project_id)

    def __get_key(self, group):
        return '{}'.format(group.id)

    def record(self, event):
        items = []
        for label, feature in self.features.items():
            for characteristics in feature.extract(event):
                if characteristics:
                    items.append((
                        self.aliases[label],
                        characteristics,
                    ))
        return self.index.record(
            self.__get_scope(event.group),
            self.__get_key(event.group),
            items,
            timestamp=to_timestamp(event.datetime),
        )

    def query(self, group):
        features = list(self.features.keys())

        results = self.index.query(
            self.__get_scope(group),
            self.__get_key(group),
            [self.aliases[label] for label in features],
        )

        items = {}
        for feature, result in zip(features, results):
            for item, score in result:
                items.setdefault(
                    int(item),
                    {},
                )[feature] = score

        return sorted(
            items.items(),
            key=lambda (id, features): sum(features.values()),
            reverse=True,
        )

    def merge(self, destination, sources, allow_unsafe=False):
        def add_index_aliases_to_key(key):
            return [(self.aliases[label], key) for label in self.features.keys()]

        # Collect all of the sources by the scope that they are contained
        # within so that we can make the most efficient queries possible and
        # reject queries that cross scopes if we haven't explicitly allowed
        # unsafe actions.
        scopes = {}
        for source in sources:
            scopes.setdefault(
                self.__get_scope(source),
                set(),
            ).add(source)

        unsafe_scopes = set(scopes.keys()) - set([self.__get_scope(destination)])
        if unsafe_scopes and not allow_unsafe:
            raise ValueError('all groups must belong to same project if unsafe merges are not allowed')

        destination_scope = self.__get_scope(destination)
        destination_key = self.__get_key(destination)

        for source_scope, sources in scopes.items():
            items = []
            for source in sources:
                items.extend(
                    add_index_aliases_to_key(
                        self.__get_key(source),
                    ),
                )

            if source_scope != destination_scope:
                imports = [
                    (alias, destination_key, data)
                    for (alias, _), data in
                    zip(
                        items,
                        self.index.export(source_scope, items),
                    )
                ]
                self.index.delete(source_scope, items)
                self.index.import_(destination_scope, imports)
            else:
                self.index.merge(
                    destination_scope,
                    destination_key,
                    items,
                )

    def delete(self, group):
        key = self.__get_key(group)
        return self.index.delete(
            self.__get_scope(group),
            [(self.aliases[label], key) for label in self.features.keys()],
        )


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
