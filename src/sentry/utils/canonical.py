"""
sentry.utils.canonical
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2018 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

from django.conf import settings

import copy
import collections
import six

__all__ = ('CanonicalKeyDict', 'CanonicalKeyView', 'get_canonical_name')

CANONICAL_KEY_MAPPING = {
    'sentry.interfaces.Exception': 'exception',
    'sentry.interfaces.Message': 'logentry',
    'sentry.interfaces.Stacktrace': 'stacktrace',
    'sentry.interfaces.Template': 'template',
    'sentry.interfaces.Http': 'request',
    'sentry.interfaces.User': 'user',
    'sentry.interfaces.Csp': 'csp',
    'sentry.interfaces.Breadcrumbs': 'breadcrumbs',
    'sentry.interfaces.Contexts': 'contexts',
    'sentry.interfaces.Threads': 'threads',
    'sentry.interfaces.DebugMeta': 'debug_meta',
}

LEGACY_KEY_MAPPING = {CANONICAL_KEY_MAPPING[k]: k for k in CANONICAL_KEY_MAPPING}


def get_canonical_name(key):
    return CANONICAL_KEY_MAPPING.get(key, key)


def get_legacy_name(key):
    return LEGACY_KEY_MAPPING.get(key, key)


class CanonicalKeyView(collections.Mapping):
    def __init__(self, data):
        self.data = data
        self._len = len(set(get_canonical_name(key) for key in self.data))

    def copy(self):
        return self

    __copy__ = copy

    def __len__(self):
        return self._len

    def __iter__(self):
        # Preserve the order of iteration while prioritizing canonical keys
        keys = list(self.data)
        for key in keys:
            canonical = get_canonical_name(key)
            if canonical == key or canonical not in keys:
                yield canonical

    def __getitem__(self, key):
        canonical = get_canonical_name(key)
        if canonical in self.data:
            return self.data[canonical]

        legacy = get_legacy_name(key)
        if legacy in self.data:
            return self.data[legacy]

        raise KeyError(key)

    def __repr__(self):
        return self.data.__repr__()


class CanonicalKeyDict(collections.MutableMapping):
    def __init__(self, data, legacy=None):
        self.legacy = legacy
        self.__init(data)

    def __init(self, data):
        legacy = self.legacy
        if legacy is None:
            legacy = settings.PREFER_CANONICAL_LEGACY_KEYS
        norm_func = legacy and get_legacy_name or get_canonical_name
        self._norm_func = norm_func
        self.data = {}
        for key, value in six.iteritems(data):
            canonical_key = norm_func(key)
            if key == canonical_key or canonical_key not in self.data:
                self.data[canonical_key] = value

    def __getstate__(self):
        state = dict(self.__dict__)
        state.pop('_norm_func', None)
        return state

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.__init(state['data'])

    def copy(self):
        rv = object.__new__(self.__class__)
        rv._norm_func = self._norm_func
        rv.data = copy.copy(self.data)
        return rv

    __copy__ = copy

    def __len__(self):
        return len(self.data)

    def __iter__(self):
        return iter(self.data)

    def __contains__(self, key):
        return self._norm_func(key) in self.data

    def __getitem__(self, key):
        return self.data[self._norm_func(key)]

    def __setitem__(self, key, value):
        self.data[self._norm_func(key)] = value

    def __delitem__(self, key):
        del self.data[self._norm_func(key)]

    def __repr__(self):
        return self.data.__repr__()


CANONICAL_TYPES = (CanonicalKeyDict, CanonicalKeyView)
