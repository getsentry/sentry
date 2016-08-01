"""
sentry.interfaces.contexts
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six
import string

from django.utils.encoding import force_text

from sentry.utils.safe import trim
from sentry.interfaces.base import Interface


__all__ = ('Contexts',)

EMPTY_VALUES = frozenset(('', None))

context_types = {}


class _IndexFormatter(string.Formatter):

    def format_field(self, value, format_spec):
        if not format_spec and isinstance(value, bool):
            return value and 'yes' or 'no'
        return string.Formatter.format_field(self, value, format_spec)


def format_index_expr(format_string, data):
    return six.text_type(_IndexFormatter().vformat(
        six.text_type(format_string), (), data).strip())


def contexttype(name):
    def decorator(cls):
        cls.type = name
        context_types[name] = cls
        return cls
    return decorator


class ContextType(object):
    indexed_fields = None

    def __init__(self, alias, data):
        self.alias = alias
        ctx_data = {}
        for key, value in six.iteritems(trim(data)):
            if value not in EMPTY_VALUES:
                ctx_data[force_text(key)] = value
        self.data = ctx_data

    def to_json(self):
        rv = dict(self.data)
        rv['type'] = self.type
        return rv

    def iter_tags(self):
        if self.indexed_fields:
            for field, f_string in six.iteritems(self.indexed_fields):
                try:
                    value = format_index_expr(f_string, self.data)
                except KeyError:
                    continue
                if value:
                    if not field:
                        yield (self.alias, value)
                    else:
                        yield ('%s.%s' % (self.alias, field), value)


# TODO(dcramer): contexts need to document/describe expected (optional) fields
@contexttype('default')
class DefaultContextType(ContextType):
    pass


@contexttype('device')
class DeviceContextType(ContextType):
    indexed_fields = {
        '': u'{model}',
        'family': u'{family}',
    }
    # model_id, arch


@contexttype('runtime')
class RuntimeContextType(ContextType):
    indexed_fields = {
        '': u'{name} {version}',
        'name': u'{name}',
    }


@contexttype('browser')
class BrowserContextType(ContextType):
    indexed_fields = {
        '': u'{name} {version}',
        'name': u'{name}',
    }
    # viewport


@contexttype('os')
class OsContextType(ContextType):
    indexed_fields = {
        '': u'{name} {version}',
        'name': u'{name}',
        'rooted': u'{rooted}',
    }
    # build, rooted


class Contexts(Interface):
    """
    This interface stores context specific information.
    """
    display_score = 1100
    score = 800

    @classmethod
    def to_python(cls, data):
        rv = {}
        for alias, value in six.iteritems(data):
            rv[alias] = cls.normalize_context(alias, value)
        return cls(**rv)

    @classmethod
    def normalize_context(cls, alias, data):
        ctx_type = data.get('type', alias)
        ctx_cls = context_types.get(ctx_type, DefaultContextType)
        return ctx_cls(alias, data)

    def iter_contexts(self):
        return six.itervalues(self._data)

    def to_json(self):
        rv = {}
        for alias, inst in six.iteritems(self._data):
            rv[alias] = inst.to_json()
        return rv

    def iter_tags(self):
        for inst in self.iter_contexts():
            for tag in inst.iter_tags():
                yield tag

    def get_path(self):
        return 'contexts'
