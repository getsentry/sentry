from __future__ import absolute_import

from django.conf import settings
from django.utils.html import escape
from django.utils.translation import ugettext as _

from sentry.utils.imports import import_string


def get_interface(name):
    try:
        import_path = settings.SENTRY_INTERFACES[name]
    except KeyError:
        raise ValueError('Invalid interface name: %s' % (name,))

    try:
        interface = import_string(import_path)
    except Exception:
        raise ValueError('Unable to load interface: %s' % (name,))

    return interface


class Interface(object):
    """
    An interface is a structured representation of data, which may
    render differently than the default ``extra`` metadata in an event.
    """

    _data = None
    score = 0
    display_score = None

    __slots__ = ['_data']

    def __init__(self, **data):
        self._data = data or {}

    def __eq__(self, other):
        if type(self) != type(other):
            return False
        return self._data == other._data

    def __getstate__(self):
        return dict(
            (slot, self.__dict__.get(slot))
            for slot in self.__slots__
        )

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
    def to_python(cls, data):
        return cls(data)

    def to_json(self):
        # eliminate empty values for serialization to compress the keyspace
        # and save (seriously) ridiculous amounts of bytes
        return dict(
            (k, v) for k, v in self._data.iteritems() if v
        )

    def get_path(self):
        cls = type(self)
        return '%s.%s' % (cls.__module__, cls.__name__)

    def get_alias(self):
        return self.get_slug()

    def get_hash(self):
        return []

    def compute_hashes(self):
        result = self.get_hash()
        if not result:
            return []
        return [result]

    def get_slug(self):
        return type(self).__name__.lower()

    def get_title(self):
        return _(type(self).__name__)

    def get_display_score(self):
        return self.display_score or self.score

    def get_score(self):
        return self.score

    def to_html(self, event, is_public=False, **kwargs):
        return ''

    def to_string(self, event, is_public=False, **kwargs):
        return ''

    def to_email_html(self, event, **kwargs):
        body = self.to_string(event)
        if not body:
            return ''
        return '<pre>%s</pre>' % (escape(body).replace('\n', '<br>'),)
