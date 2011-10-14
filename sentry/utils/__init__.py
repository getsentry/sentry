"""
sentry.utils
~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import hashlib
import logging
from pprint import pformat

import django
from django.conf import settings as django_settings
from django.http import HttpRequest
from django.utils.encoding import force_unicode

from sentry.conf import settings

_FILTER_CACHE = None
def get_filters():
    global _FILTER_CACHE

    if _FILTER_CACHE is None:

        filters = []
        for filter_ in settings.FILTERS:
            if filter_.endswith('sentry.filters.SearchFilter'):
                continue
            module_name, class_name = filter_.rsplit('.', 1)
            try:
                module = __import__(module_name, {}, {}, class_name)
                filter_ = getattr(module, class_name)
            except Exception:
                logger = logging.getLogger('sentry.errors')
                logger.exception('Unable to import %s' % (filter_,))
                continue
            filters.append(filter_)
        _FILTER_CACHE = filters
    for f in _FILTER_CACHE:
        yield f

def get_db_engine(alias='default'):
    has_multidb = django.VERSION >= (1, 2)
    if has_multidb:
        value = django_settings.DATABASES[alias]['ENGINE']
    else:
        assert alias == 'default', 'You cannot fetch a database engine other than the default on Django < 1.2'
        value = django_settings.DATABASE_ENGINE
    return value.rsplit('.', 1)[-1]

def construct_checksum(level=logging.ERROR, class_name='', traceback='', message='', **kwargs):
    checksum = hashlib.md5(str(level))
    checksum.update(class_name or '')

    if 'data' in kwargs and kwargs['data'] and '__sentry__' in kwargs['data'] and 'frames' in kwargs['data']['__sentry__']:
        frames = kwargs['data']['__sentry__']['frames']
        for frame in frames:
            checksum.update(frame['module'])
            checksum.update(frame['function'])

    elif traceback:
        traceback = '\n'.join(traceback.split('\n')[:-3])

    elif message:
        if isinstance(message, unicode):
            message = message.encode('utf-8', 'replace')
        checksum.update(message)

    return checksum.hexdigest()

class _Missing(object):

    def __repr__(self):
        return 'no value'

    def __reduce__(self):
        return '_missing'

_missing = _Missing()

class cached_property(object):
    # This is borrowed from werkzeug : http://bytebucket.org/mitsuhiko/werkzeug-main
    """A decorator that converts a function into a lazy property.  The
    function wrapped is called the first time to retrieve the result
    and then that calculated result is used the next time you access
    the value::

        class Foo(object):

            @cached_property
            def foo(self):
                # calculate something important here
                return 42

    The class has to have a `__dict__` in order for this property to
    work.

    .. versionchanged:: 0.6
       the `writeable` attribute and parameter was deprecated.  If a
       cached property is writeable or not has to be documented now.
       For performance reasons the implementation does not honor the
       writeable setting and will always make the property writeable.
    """

    # implementation detail: this property is implemented as non-data
    # descriptor.  non-data descriptors are only invoked if there is
    # no entry with the same name in the instance's __dict__.
    # this allows us to completely get rid of the access function call
    # overhead.  If one choses to invoke __get__ by hand the property
    # will still work as expected because the lookup logic is replicated
    # in __get__ for manual invocation.

    def __init__(self, func, name=None, doc=None, writeable=False):
        if writeable:
            from warnings import warn
            warn(DeprecationWarning('the writeable argument to the '
                                    'cached property is a noop since 0.6 '
                                    'because the property is writeable '
                                    'by default for performance reasons'))

        self.__name__ = name or func.__name__
        self.__module__ = func.__module__
        self.__doc__ = doc or func.__doc__
        self.func = func

    def __get__(self, obj, type=None):
        if obj is None:
            return self
        value = obj.__dict__.get(self.__name__, _missing)
        if value is _missing:
            value = self.func(obj)
            obj.__dict__[self.__name__] = value
        return value

class MockDjangoRequest(HttpRequest):
    GET = {}
    POST = {}
    META = {}
    COOKIES = {}
    FILES = {}
    raw_post_data = ''
    url = ''
    path = '/'

    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

    def __repr__(self):
        # Since this is called as part of error handling, we need to be very
        # robust against potentially malformed input.
        try:
            get = pformat(self.GET)
        except:
            get = '<could not parse>'
        try:
            post = pformat(self.POST)
        except:
            post = '<could not parse>'
        try:
            cookies = pformat(self.COOKIES)
        except:
            cookies = '<could not parse>'
        try:
            meta = pformat(self.META)
        except:
            meta = '<could not parse>'
        return '<Request\nGET:%s,\nPOST:%s,\nCOOKIES:%s,\nMETA:%s>' % \
            (get, post, cookies, meta)

    def build_absolute_uri(self): return self.url

def should_mail(group):
    if int(group.level) < settings.MAIL_LEVEL:
        return False
    if settings.MAIL_INCLUDE_LOGGERS is not None and group.logger not in settings.MAIL_INCLUDE_LOGGERS:
        return False
    if settings.MAIL_EXCLUDE_LOGGERS and group.logger in settings.MAIL_EXCLUDE_LOGGERS:
        return False
    return True

def to_unicode(value):
    try:
        value = unicode(force_unicode(value))
    except (UnicodeEncodeError, UnicodeDecodeError):
        value = '(Error decoding value)'
    except Exception: # in some cases we get a different exception
        try:
            value = str(repr(type(value)))
        except Exception:
            value = '(Error decoding value)'
    return value

def is_float(var):
    try:
        float(var)
    except ValueError:
        return False
    return True
