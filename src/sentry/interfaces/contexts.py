"""
sentry.interfaces.contexts
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.utils.encoding import force_text

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

    def iter_tags(self):
        for field, f_string in self.indexed_fields.iteritems():
            try:
                value = f_string.format(**self.data).strip()
            except KeyError:
                continue
            if value:
                if not field:
                    yield (self.alias, value)
                yield ('%s.%s' % (self.alias, field), value)


# TODO(dcramer): contexts need to document/describe expected (optional) fields
@contexttype('default')
class DefaultContextType(ContextType):
    pass


@contexttype('device')
class DeviceContextType(ContextType):
    indexed_fields = {
        '': '{model}',
    }
    # model_id, arch


@contexttype('runtime')
class RuntimeContextType(ContextType):
    indexed_fields = {
        '': '{name}',
        'version': '{name} {version}',
    }


@contexttype('browser')
class BrowserContextType(ContextType):
    indexed_fields = {
        '': '{name}',
        'version': '{name} {version}',
    }
    # viewport


@contexttype('os')
class OsContextType(ContextType):
    indexed_fields = {
        '': '{name}',
        'version': '{name} {version}',
    }
    # build


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
        ctx_type = data.get('type', alias)
        ctx_cls = context_types.get(ctx_type, DefaultContextType)
        ctx_data = {}
        for key, value in trim(data).iteritems():
            ctx_data[force_text(key)] = force_text(value)
        ctx_data['type'] = ctx_cls.type
        return ctx_cls(alias, ctx_data)

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
