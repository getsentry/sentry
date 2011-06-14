import hmac
import logging
import sys
import uuid
from pprint import pformat
from types import ClassType, TypeType

import django
from django.conf import settings as django_settings
from django.utils.encoding import force_unicode
from django.utils.functional import Promise
from django.utils.hashcompat import md5_constructor, sha_constructor

import sentry
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
    checksum = md5_constructor(str(level))
    checksum.update(class_name or '')
    if traceback:
        traceback = '\n'.join(traceback.split('\n')[:-3])
    message = traceback or message
    if isinstance(message, unicode):
        message = message.encode('utf-8', 'replace')
    checksum.update(message)
    return checksum.hexdigest()

def varmap(func, var, context=None):
    if context is None:
        context = {}
    objid = id(var)
    if objid in context:
        return func('<...>')
    context[objid] = 1
    if isinstance(var, dict):
        ret = dict((k, varmap(func, v, context)) for k, v in var.iteritems())
    elif isinstance(var, (list, tuple)):
        ret = [varmap(func, f, context) for f in var]
    else:
        ret = func(var)
    del context[objid]
    return ret

def has_sentry_metadata(value):
    try:
        return callable(value.__getattribute__("__sentry__"))
    except:
        return False

def transform(value, stack=[], context=None):
    # TODO: make this extendable
    if context is None:
        context = {}

    objid = id(value)
    if objid in context:
        return '<...>'

    context[objid] = 1
    transform_rec = lambda o: transform(o, stack + [value], context)

    if any(value is s for s in stack):
        ret = 'cycle'
    elif isinstance(value, (tuple, list, set, frozenset)):
        ret = type(value)(transform_rec(o) for o in value)
    elif isinstance(value, uuid.UUID):
        ret = repr(value)
    elif isinstance(value, dict):
        ret = dict((k, transform_rec(v)) for k, v in value.iteritems())
    elif isinstance(value, unicode):
        ret = to_unicode(value)
    elif isinstance(value, str):
        try:
            ret = str(value.decode('utf-8').encode('utf-8'))
        except:
            ret = to_unicode(value)
    elif not isinstance(value, (ClassType, TypeType)) and \
            has_sentry_metadata(value):
        ret = transform_rec(value.__sentry__())
    elif isinstance(value, Promise):
        # EPIC HACK
        # handles lazy model instances (which are proxy values that dont easily give you the actual function)
        pre = value.__class__.__name__[1:]
        value = getattr(value, '%s__func' % pre)(*getattr(value, '%s__args' % pre), **getattr(value, '%s__kw' % pre))
        return transform(value)
    elif not isinstance(value, (int, bool)) and value is not None:
        try:
            ret = transform(repr(value))
        except:
            # It's common case that a model's __unicode__ definition may try to query the database
            # which if it was not cleaned up correctly, would hit a transaction aborted exception
            ret = u'<BadRepr: %s>' % type(value)
    else:
        ret = value
    del context[objid]
    return ret

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

def get_installed_apps():
    """
    Generate a list of modules in settings.INSTALLED_APPS.
    """
    out = set()
    for app in django_settings.INSTALLED_APPS:
        out.add(app)
    return out

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

def get_versions(module_list=None):
    if not module_list:
        module_list = django_settings.INSTALLED_APPS + ['django']

    ext_module_list = set()
    for m in module_list:
        parts = m.split('.')
        ext_module_list.update('.'.join(parts[:idx]) for idx in xrange(1, len(parts)+1))

    versions = {}
    for module_name in ext_module_list:
        __import__(module_name)
        app = sys.modules[module_name]
        if hasattr(app, 'get_version'):
            get_version = app.get_version
            if callable(get_version):
                version = get_version()
            else:
                version = get_version
        elif hasattr(app, 'VERSION'):
            version = app.VERSION
        elif hasattr(app, '__version__'):
            version = app.__version__
        else:
            continue
        if isinstance(version, (list, tuple)):
            version = '.'.join(str(o) for o in version)
        versions[module_name] = version
    return versions

def shorten(var):
    var = transform(var)
    if isinstance(var, basestring) and len(var) > settings.MAX_LENGTH_STRING:
        var = var[:settings.MAX_LENGTH_STRING] + '...'
    elif isinstance(var, (list, tuple, set, frozenset)) and len(var) > settings.MAX_LENGTH_LIST:
        # TODO: we should write a real API for storing some metadata with vars when
        # we get around to doing ref storage
        # TODO: when we finish the above, we should also implement this for dicts
        var = list(var)[:settings.MAX_LENGTH_LIST] + ['...', '(%d more elements)' % (len(var) - settings.MAX_LENGTH_LIST,)]
    return var

def is_float(var):
    try:
        float(var)
    except ValueError:
        return False
    return True

def get_signature(message, timestamp):
    return hmac.new(settings.KEY, '%s %s' % (timestamp, message), sha_constructor).hexdigest()

def get_auth_header(signature, timestamp, client):
    return 'Sentry sentry_signature=%s, sentry_timestamp=%s, sentry_client=%s' % (
        signature,
        timestamp,
        sentry.VERSION,
    )

def parse_auth_header(header):
    return dict(map(lambda x: x.strip().split('='), header.split(' ', 1)[1].split(',')))

class MockDjangoRequest(object):
    GET = {}
    POST = {}
    META = {}
    COOKIES = {}
    FILES = {}
    raw_post_data = ''
    url = ''
    
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
