from __future__ import absolute_import

import os

from collections import OrderedDict
import logging
import six

from django.conf import settings
from django.utils.translation import ugettext as _

from sentry.utils.canonical import get_canonical_name
from sentry.utils.html import escape
from sentry.utils.imports import import_string
from sentry.utils.safe import safe_execute
from sentry.utils.decorators import classproperty


logger = logging.getLogger("sentry.events")
interface_logger = logging.getLogger("sentry.interfaces")

# This flag is only effectively used for the testsuite. In production the
# return value of `sentry.models.event._should_skip_to_python` is explicitly
# passed to interfaces.
RUST_RENORMALIZED_DEFAULT = os.environ.get(
    "SENTRY_TEST_USE_RUST_INTERFACE_RENORMALIZATION",
    "false"
).lower() in ("true", "1")


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


def get_interfaces(data, rust_renormalized=RUST_RENORMALIZED_DEFAULT):
    result = []
    for key, data in six.iteritems(data):
        # Skip invalid interfaces that were nulled out during normalization
        if data is None:
            continue

        try:
            cls = get_interface(key)
        except ValueError:
            continue

        value = safe_execute(cls.to_python, data,
                             rust_renormalized=rust_renormalized,
                             _with_transaction=False)
        if not value:
            continue

        result.append((key, value))

    return OrderedDict(
        (k, v) for k, v in sorted(result, key=lambda x: x[1].get_score(), reverse=True)
    )


def prune_empty_keys(obj):
    if obj is None:
        return None

    # eliminate None values for serialization to compress the keyspace
    # and save (seriously) ridiculous amounts of bytes
    #
    # Do not coerce empty arrays/dicts or other "falsy" values here to None,
    # but rather deal with them case-by-case before calling `prune_empty_keys`
    # (e.g. in `Interface.to_json`). Rarely, but sometimes, there's a slight
    # semantic difference between empty containers and a missing value. One
    # example would be `event.logenty.formatted`, where `{}` means "this
    # message has no params" and `None` means "this message is already
    # formatted".
    return dict((k, v) for k, v in six.iteritems(obj) if v is not None)


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
    grouping_variants = ['default']

    def __init__(self, **data):
        self._data = data or {}

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
        if name == '_data':
            self.__dict__['_data'] = value
        else:
            self._data[name] = value

    @classmethod
    def to_python(cls, data, rust_renormalized=RUST_RENORMALIZED_DEFAULT):
        """Creates a python interface object from the given raw data.

        This function can assume fully normalized and valid data. It can create
        defaults where data is missing but does not need to handle interface
        validation.
        """
        return cls(**data) if data is not None else None

    def get_api_context(self, is_public=False):
        return self.to_json()

    def get_api_meta(self, meta, is_public=False):
        return meta

    def to_json(self):
        return prune_empty_keys(self._data)

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
        return '<pre>%s</pre>' % (escape(body), )

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
