from __future__ import absolute_import

import functools
import itertools
import logging

from sentry.utils.dates import to_timestamp

logger = logging.getLogger('sentry.similarity')


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
                exception.stacktrace.frames,
                key=lambda frame: frame.in_app,
            )
        )
    )


class ExceptionFeature(object):
    def __init__(self, function):
        self.function = function

    def extract(self, event):
        return self.function(
            event.interfaces['sentry.interfaces.Exception'].values[0],
        )


class MessageFeature(object):
    def __init__(self, function):
        self.function = function

    def extract(self, event):
        return self.function(
            event.interfaces['sentry.interfaces.Message'],
        )


class FeatureSet(object):
    def __init__(self, index, encoder, aliases, features, expected_encoding_errors):
        self.index = index
        self.encoder = encoder
        self.aliases = aliases
        self.features = features
        self.expected_encoding_errors = expected_encoding_errors
        assert set(self.aliases) == set(self.features)

    def __get_scope(self, project):
        return '{}'.format(project.id)

    def __get_key(self, group):
        return '{}'.format(group.id)

    def extract(self, event):
        results = {}
        for label, strategy in self.features.items():
            try:
                results[label] = strategy.extract(event)
            except Exception as error:
                logger.warning(
                    'Could not extract features from %r for %r due to error: %r',
                    event,
                    label,
                    error,
                    exc_info=True,
                )
        return results

    def record(self, event):
        items = []
        for label, features in self.extract(event).items():
            try:
                features = map(self.encoder.dumps, features)
            except Exception as error:
                log = (
                    logger.debug if isinstance(error, self.expected_encoding_errors) else
                    functools.partial(logger.warning, exc_info=True)
                )
                log(
                    'Could not encode features from %r for %r due to error: %r',
                    event,
                    label,
                    error,
                )
            else:
                if features:
                    items.append((self.aliases[label], features, ))
        return self.index.record(
            self.__get_scope(event.project),
            self.__get_key(event.group),
            items,
            timestamp=to_timestamp(event.datetime),
        )

    def classify(self, event):
        items = []
        for label, features in self.extract(event).items():
            try:
                features = map(self.encoder.dumps, features)
            except Exception as error:
                log = (
                    logger.debug
                    if isinstance(error, self.expected_encoding_errors) else
                    functools.partial(
                        logger.warning,
                        exc_info=True
                    )
                )
                log(
                    'Could not encode features from %r for %r due to error: %r',
                    event,
                    label,
                    error,
                )
            else:
                if features:
                    items.append((
                        self.aliases[label],
                        features,
                    ))
        results = self.index.classify(
            self.__get_scope(event.project),
            items,
            timestamp=to_timestamp(event.datetime),
        )
        return zip(
            map(
                lambda (alias, characteristics): self.aliases.get_key(alias),
                items,
            ),
            results,
        )

    def compare(self, group):
        features = list(self.features.keys())

        results = self.index.compare(
            self.__get_scope(group.project),
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
                self.__get_scope(source.project),
                set(),
            ).add(source)

        unsafe_scopes = set(scopes.keys()) - set([self.__get_scope(destination.project)])
        if unsafe_scopes and not allow_unsafe:
            raise ValueError(
                'all groups must belong to same project if unsafe merges are not allowed'
            )

        destination_scope = self.__get_scope(destination.project)
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
                    for (alias, _), data in zip(
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
            self.__get_scope(group.project),
            [(self.aliases[label], key) for label in self.features.keys()],
        )

    def flush(self, project=None):
        return self.index.flush(
            '*' if project is None else self.__get_scope(project),
            self.aliases.values(),
        )
