import base64
try:
    import cPickle as pickle
except ImportError:
    import pickle
import logging
import sys
import traceback
import urllib2
import uuid

from django.core.cache import cache
from django.template import TemplateSyntaxError
from django.views.debug import ExceptionReporter

from sentry import conf
from sentry.helpers import construct_checksum, varmap, transform, get_installed_apps, urlread, force_unicode, \
                           get_versions

logger = logging.getLogger('sentry.errors')

class SentryClient(object):
    def process(self, **kwargs):
        "Processes the message before passing it on to the server"
        from sentry.helpers import get_filters

        if kwargs.get('data'):
            # Ensure we're not changing the original data which was passed
            # to Sentry
            kwargs['data'] = kwargs['data'].copy()

        request = kwargs.pop('request', None)
        if request:
            if not kwargs.get('data'):
                kwargs['data'] = {}
            kwargs['data'].update(dict(
                META=request.META,
                POST=request.POST,
                GET=request.GET,
                COOKIES=request.COOKIES,
            ))

            if not kwargs.get('url'):
                kwargs['url'] = request.build_absolute_uri()

        kwargs.setdefault('level', logging.ERROR)
        kwargs.setdefault('server_name', conf.NAME)

        # save versions of all installed apps
        if 'data' not in kwargs or '__sentry__' not in (kwargs['data'] or {}):
            if kwargs.get('data') is None:
                kwargs['data'] = {}
            kwargs['data']['__sentry__'] = {}

        versions = get_versions()
        kwargs['data']['__sentry__']['versions'] = versions

        if kwargs.get('view'):
            # get list of modules from right to left
            parts = kwargs['view'].split('.')
            module_list = ['.'.join(parts[:idx]) for idx in xrange(1, len(parts)+1)][::-1]
            version = None
            module = None
            for m in module_list:
                if m in versions:
                    module = m
                    version = versions[m]

            # store our "best guess" for application version
            if version:
                kwargs['data']['__sentry__'].update({
                    'version': version,
                    'module': module,
                })

        if 'checksum' not in kwargs:
            checksum = construct_checksum(**kwargs)
        else:
            checksum = kwargs['checksum']

        if conf.THRASHING_TIMEOUT and conf.THRASHING_LIMIT:
            cache_key = 'sentry:%s:%s' % (kwargs.get('class_name') or '', checksum)
            added = cache.add(cache_key, 1, conf.THRASHING_TIMEOUT)
            if not added:
                try:
                    thrash_count = cache.incr(cache_key)
                except (KeyError, ValueError):
                    # cache.incr can fail. Assume we aren't thrashing yet, and
                    # if we are, hope that the next error has a successful
                    # cache.incr call.
                    thrash_count = 0
                if thrash_count > conf.THRASHING_LIMIT:
                    return

        for filter_ in get_filters():
            kwargs = filter_(None).process(kwargs) or kwargs
        
        # create ID client-side so that it can be passed to application
        message_id = uuid.uuid4().hex
        kwargs['message_id'] = message_id

        # Make sure all data is coerced
        kwargs = transform(kwargs)

        self.send(**kwargs)
        
        return message_id

    def send(self, **kwargs):
        "Sends the message to the server."
        if conf.REMOTE_URL:
            for url in conf.REMOTE_URL:
                data = {
                    'data': base64.b64encode(pickle.dumps(kwargs).encode('zlib')),
                    'key': conf.KEY,
                }
                try:
                    urlread(url, post=data, timeout=conf.REMOTE_TIMEOUT)
                except urllib2.HTTPError, e:
                    body = e.read()
                    logger.error('Unable to reach Sentry log server: %s (url: %%s, body: %%s)' % (e,), url, body,
                                 exc_info=sys.exc_info(), extra={'data':{'body': body, 'remote_url': url}})
                    logger.log(kwargs.pop('level', None) or logging.ERROR, kwargs.pop('message', None))
                except urllib2.URLError, e:
                    logger.error('Unable to reach Sentry log server: %s (url: %%s)' % (e,), url,
                                 exc_info=sys.exc_info(), extra={'data':{'remote_url': url}})
                    logger.log(kwargs.pop('level', None) or logging.ERROR, kwargs.pop('message', None))
        else:
            from sentry.models import GroupedMessage
            
            return GroupedMessage.objects.from_kwargs(**kwargs)

    def create_from_record(self, record, **kwargs):
        """
        Creates an error log for a ``logging`` module ``record`` instance.
        """
        for k in ('url', 'view', 'request', 'data'):
            if k not in kwargs:
                kwargs[k] = record.__dict__.get(k)
        
        kwargs.update({
            'logger': record.name,
            'level': record.levelno,
            'message': force_unicode(record.msg),
            'server_name': conf.NAME,
        })
        
        # construct the checksum with the unparsed message
        kwargs['checksum'] = construct_checksum(**kwargs)
        
        # save the message with included formatting
        kwargs['message'] = record.getMessage()
        
        # If there's no exception being processed, exc_info may be a 3-tuple of None
        # http://docs.python.org/library/sys.html#sys.exc_info
        if record.exc_info and all(record.exc_info):
            return self.create_from_exception(record.exc_info, **kwargs)

        return self.process(
            traceback=record.exc_text,
            **kwargs
        )

    def create_from_text(self, message, **kwargs):
        """
        Creates an error log for from ``message``.
        """
        return self.process(
            message=message,
            **kwargs
        )

    def create_from_exception(self, exc_info=None, **kwargs):
        """
        Creates an error log from an exception.
        """
        if not exc_info:
            exc_info = sys.exc_info()

        exc_type, exc_value, exc_traceback = exc_info

        def shorten(var):
            var = transform(var)
            if isinstance(var, basestring) and len(var) > 200:
                var = var[:200] + '...'
            return var

        reporter = ExceptionReporter(None, exc_type, exc_value, exc_traceback)
        frames = varmap(shorten, reporter.get_traceback_frames())

        if not kwargs.get('view'):
            # This should be cached
            modules = get_installed_apps()
            if conf.INCLUDE_PATHS:
                modules = set(list(modules) + conf.INCLUDE_PATHS)

            def iter_tb_frames(tb):
                while tb:
                    yield tb.tb_frame
                    tb = tb.tb_next
            
            def contains(iterator, value):
                for k in iterator:
                    if value.startswith(k):
                        return True
                return False
                
            # We iterate through each frame looking for an app in INSTALLED_APPS
            # When one is found, we mark it as last "best guess" (best_guess) and then
            # check it against SENTRY_EXCLUDE_PATHS. If it isnt listed, then we
            # use this option. If nothing is found, we use the "best guess".
            best_guess = None
            view = None
            for frame in iter_tb_frames(exc_traceback):
                try:
                    view = '.'.join([frame.f_globals['__name__'], frame.f_code.co_name])
                except:
                    continue
                if contains(modules, view):
                    if not (contains(conf.EXCLUDE_PATHS, view) and best_guess):
                        best_guess = view
                elif best_guess:
                    break
            if best_guess:
                view = best_guess
            
            if view:
                kwargs['view'] = view

        data = kwargs.pop('data', {}) or {}
        if hasattr(exc_type, '__class__'):
            exc_module = exc_type.__class__.__module__
        else:
            exc_module = None
        data['__sentry__'] = {
            'exc': map(transform, [exc_module, exc_value.args, frames]),
        }

        if isinstance(exc_value, TemplateSyntaxError) and hasattr(exc_value, 'source'):
            origin, (start, end) = exc_value.source
            data['__sentry__'].update({
                'template': (origin.reload(), start, end, origin.name),
            })
            kwargs['view'] = origin.loadname
        
        tb_message = '\n'.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

        kwargs.setdefault('message', transform(force_unicode(exc_value)))

        return self.process(
            class_name=exc_type.__name__,
            traceback=tb_message,
            data=data,
            **kwargs
        )

class DummyClient(SentryClient):
    "Sends messages into an empty void"
    def send(self, **kwargs):
        return None
