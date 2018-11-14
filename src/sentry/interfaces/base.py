from __future__ import absolute_import

import logging
import six
from collections import OrderedDict

from django.conf import settings
from django.utils.translation import ugettext as _

from sentry.utils.canonical import get_canonical_name
from sentry.utils.html import escape
from sentry.utils.imports import import_string
from sentry.utils.safe import safe_execute
from sentry.utils.decorators import classproperty


logger = logging.getLogger("sentry.events")


def get_interface(name):
    try:
        name = get_canonical_name(name)
        import_path = settings.SENTRY_INTERFACES[name]
    except KeyError:
        raise ValueError('Invalid interface name: %s' % (name, ))

    try:
        interface = import_string(import_path)
    except Exception:
        raise ValueError('Unable to load interface: %s' % (name, ))

    return interface


def get_interfaces(data):
    result = []
    for key, data in six.iteritems(data):
        try:
            cls = get_interface(key)
        except ValueError:
            continue

        value = safe_execute(
            cls.to_python, data, _with_transaction=False
        )
        if not value:
            continue

        if value.get_errors():
            continue

        result.append((key, value))

    return OrderedDict(
        (k, v) for k, v in sorted(result, key=lambda x: x[1].get_score(), reverse=True)
    )


class Meta(object):
    def __init__(self, meta=None, path=None):
        self._meta = meta or {}
        self._path = path or []

    def enter(self, *path):
        return Meta(self._meta, path=self._path + map(six.text_type, path))

    def raw(self):
        meta = self._meta
        for key in self._path:
            meta = meta.get(key) or {}
        return meta

    def get(self):
        return self.raw().get('') or {}

    def create(self):
        meta = self._meta
        for key in self._path + ['']:
            if key not in meta or meta[key] is None:
                meta[key] = {}
            meta = meta[key]

        return meta

    def merge(self, other):
        other = other.get()
        if not other:
            return

        meta = self.create()
        err = meta.get('err')
        meta.update(other)

        if err and other.get('err'):
            meta['err'] = err + other['err']

    def get_errors(self):
        self.get().get('err') or []

    def add_error(self, error, value=None):
        meta = self.create()
        if 'err' not in meta or meta['err'] is None:
            meta['err'] = []
        meta['err'].append(six.text_type(error))

        if value is not None:
            meta['val'] = value


class InterfaceValidationError(Exception):
    pass


class Interface(object):
    """
    An interface is a structured representation of data, which may
    render differently than the default ``extra`` metadata in an event.
    """

    _data = None
    score = 0
    display_score = None
    ephemeral = False

    def __init__(self, **data):
        self._data = data or {}
        self._meta = Meta()

    @classproperty
    def path(cls):
        """The 'path' of the interface which is the root key in the data."""
        return cls.__name__.lower()

    @classproperty
    def external_type(cls):
        """The external name of the interface.  This is mostly the same as
        path with some small differences (message, debugmeta).
        """
        return cls.path

    def __eq__(self, other):
        if not isinstance(self, type(other)):
            return False
        return self._data == other._data

    def __getstate__(self):
        return {'_data': self._data}

    def __setstate__(self, state):
        self.__dict__.update(state)
        if not hasattr(self, '_data'):
            self._data = {}

    def __getattr__(self, name):
        return self._data[name]

    def __setattr__(self, name, value):
        if name in ('_data', '_meta'):
            self.__dict__[name] = value
        else:
            self._data[name] = value

    @classmethod
    def _to_python(cls, data, meta, **kwargs):
        return cls(**data)

    @classmethod
    def to_python(cls, data, meta=None, **kwargs):
        """Creates a python interface object from the given raw data. By
        default, this uses all keys passed in as `data`.

        To override this behavior, implement `_to_python`.
        """

        if meta is None:
            meta = Meta()

        try:
            if meta.get_errors():
                instance = cls()
            else:
                instance = cls._to_python(data, meta, **kwargs)
        except Exception as e:
            # TODO(ja): Remove this after switching to Rust normalization
            if not isinstance(e, InterfaceValidationError):
                logger.error('Discarded invalid value for interface: %s (%r)',
                             cls().get_slug(), data, exc_info=True)

            meta.add_error(e, value=data)
            instance = cls()

        instance._meta = meta
        return instance

    def get_api_context(self, is_public=False):
        return self.to_json()

    def get_api_meta(self, meta, is_public=False):
        return meta

    def to_json(self):
        # eliminate empty values for serialization to compress the keyspace
        # and save (seriously) ridiculous amounts of bytes
        # XXX(dcramer): its important that we keep zero values here, but empty
        # lists and strings get discarded as we've deemed them not important
        return dict((k, v) for k, v in six.iteritems(self._data) if (v == 0 or v))

    def get_hash(self):
        return []

    def compute_hashes(self, platform):
        result = self.get_hash()
        if not result:
            return []
        return [result]

    def get_title(self):
        return _(type(self).__name__)

    def get_display_score(self):
        return self.display_score or self.score

    def get_score(self):
        return self.score

    def iter_tags(self):
        return iter(())

    def to_string(self, event, is_public=False, **kwargs):
        return ''

    def to_email_html(self, event, **kwargs):
        body = self.to_string(event)
        if not body:
            return ''
        return '<pre>%s</pre>' % (escape(body),)

    def get_errors(self):
        return self._meta.get().get('err', [])

    # deprecated stuff.  These were deprecated in late 2018, once
    # determined they are unused we can kill them.

    def get_path(self):
        from warnings import warn
        warn(DeprecationWarning('Replaced with .path'))
        return self.path

    def get_alias(self):
        from warnings import warn
        warn(DeprecationWarning('Replaced with .path'))
        return self.path

    def get_slug(self):
        from warnings import warn
        warn(DeprecationWarning('Replaced with .path'))
        return self.path
