from __future__ import absolute_import

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
        try:
            exceptions = event.interfaces['sentry.interfaces.Exception'].values
        except KeyError as error:
            logger.info(
                'Could not extract characteristic(s) from %r due to error: %r',
                event,
                error,
                exc_info=True)
            return

        for exception in exceptions:
            try:
                yield self.function(exception)
            except Exception as error:
                logger.exception(
                    'Could not extract characteristic(s) from exception in %r due to error: %r',
                    event,
                    error)


class MessageFeature(object):
    def __init__(self, function):
        self.function = function

    def extract(self, event):
        try:
            message = event.interfaces['sentry.interfaces.Message']
        except KeyError as error:
            logger.info(
                'Could not extract characteristic(s) from %r due to error: %r',
                event,
                error,
                exc_info=True)
            return

        try:
            yield self.function(message)
        except Exception as error:
            logger.exception(
                'Could not extract characteristic(s) from message of %r due to error: %r',
                event,
                error)


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
            raise ValueError(
                'all groups must belong to same project if unsafe merges are not allowed')

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
