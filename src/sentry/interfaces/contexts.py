"""
sentry.interfaces.contexts
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.utils.safe import trim
from sentry.interfaces.base import Interface


__all__ = ('Contexts',)


context_types = {}


def contexttype(name):
    def decorator(cls):
        cls.type = name
        context_types[name] = cls
        return cls
    return decorator


class ContextType(object):
    indexed_fields = []

    def __init__(self, alias, data):
        self.alias = alias
        self.data = data

    def to_json(self):
        return self.data

    def flatten_index_value(self, value):
        if isinstance(value, (int, long, basestring)):
            return value
        return unicode(value)

    def iter_tags(self):
        for field in self.indexed_fields:
            value = self.data.get(field)
            if value is not None:
                yield (
                    '%s.%s' % (self.alias, field),
                    self.flatten_index_value(value)
                )


@contexttype('default')
class DefaultContextType(ContextType):
    pass


@contexttype('device')
class DeviceContextType(ContextType):
    indexed_fields = ['name', 'model', 'model_id', 'arch']


@contexttype('runtime')
class RuntimeContextType(ContextType):
    indexed_fields = ['name', 'version', 'build']


@contexttype('os')
class OsContextType(ContextType):
    indexed_fields = ['name', 'version', 'build']


class Contexts(Interface):
    """
    This interface stores context specific information.
    """
    display_score = 1100
    score = 800

    @classmethod
    def to_python(cls, data):
        rv = {}
        for alias, value in data.iteritems():
            rv[alias] = cls.normalize_context(alias, value)
        return cls(**rv)

    @classmethod
    def normalize_context(cls, alias, data):
        type = data.get('type', alias)
        data = trim(data)
        cls = context_types.get(type, DefaultContextType)
        data['type'] = cls.type
        return cls(alias, data)

    def iter_contexts(self):
        return self._data.itervalues()

    def to_json(self):
        rv = {}
        for alias, inst in self._data.iteritems():
            rv[alias] = inst.to_json()
        return rv

    def iter_tags(self):
        for inst in self.iter_contexts():
            for tag in inst.iter_tags():
                yield tag

    def get_path(self):
        return 'contexts'
