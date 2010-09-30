import base64
try:
    import cPickle as pickle
except ImportError:
    import pickle
import logging
import sys
import traceback
import urllib2
import warnings

from django.core.cache import cache
from django.template import TemplateSyntaxError
from django.utils.encoding import smart_unicode
from django.views.debug import ExceptionReporter

from sentry import settings
from sentry.helpers import construct_checksum, varmap, transform, get_installed_apps, urlread

logger = logging.getLogger('sentry.errors')

class SentryClient(object):
    def process(self, **kwargs):
        from sentry.helpers import get_filters

        kwargs.setdefault('level', logging.ERROR)
        kwargs.setdefault('server_name', settings.NAME)

        checksum = construct_checksum(**kwargs)

        if settings.THRASHING_TIMEOUT and settings.THRASHING_LIMIT:
            cache_key = 'sentry:%s:%s' % (kwargs.get('class_name'), checksum)
            added = cache.add(cache_key, 1, settings.THRASHING_TIMEOUT)
            if not added and cache.incr(cache_key) > settings.THRASHING_LIMIT:
                return

        for filter_ in get_filters():
            kwargs = filter_(None).process(kwargs) or kwargs
        
        # Make sure all additional data is coerced
        if 'data' in kwargs:
            kwargs['data'] = transform(kwargs['data'])

        return self.send(**kwargs)

    def send(self, **kwargs):
        if settings.REMOTE_URL:
            for url in settings.REMOTE_URL:
                data = {
                    'data': base64.b64encode(pickle.dumps(kwargs).encode('zlib')),
                    'key': settings.KEY,
                }
                try:
                    response = urlread(url, GET=data, timeout=settings.REMOTE_TIMEOUT)
                except urllib2.URLError, e:
                    logger.error('Unable to reach Sentry log server: %s' % (e,), exc_info=sys.exc_info(), extra={'remote_url': url})
                    logger.log(kwargs.pop('level', None) or logging.ERROR, kwargs.pop('message', None))
                except urllib2.HTTPError, e:
                    logger.error('Unable to reach Sentry log server: %s' % (e,), exc_info=sys.exc_info(), extra={'body': e.read(), 'remote_url': url})
                    logger.log(kwargs.pop('level', None) or logging.ERROR, kwargs.pop('message', None))
        else:
            from sentry.models import GroupedMessage
            
            return GroupedMessage.objects.from_kwargs(**kwargs)

    def create_from_record(self, record, **kwargs):
        """
        Creates an error log for a `logging` module `record` instance.
        """
        for k in ('url', 'view', 'data'):
            if k not in kwargs:
                kwargs[k] = record.__dict__.get(k)
        kwargs.update({
            'logger': record.name,
            'level': record.levelno,
            'message': record.getMessage(),
        })
        if record.exc_info:
            return self.create_from_exception(record.exc_info, **kwargs)

        return self.process(
            traceback=record.exc_text,
            **kwargs
        )

    def create_from_text(self, message, **kwargs):
        """
        Creates an error log for from ``type`` and ``message``.
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

        def to_unicode(f):
            if isinstance(f, dict):
                nf = dict()
                for k, v in f.iteritems():
                    nf[str(k)] = to_unicode(v)
                f = nf
            elif isinstance(f, (list, tuple)):
                f = [to_unicode(f) for f in f]
            else:
                try:
                    f = smart_unicode(f)
                except (UnicodeEncodeError, UnicodeDecodeError):
                    f = '(Error decoding value)'
                except Exception: # in some cases we get a different exception
                    f = smart_unicode(type(f))
            return f

        def shorten(var):
            if not isinstance(var, basestring):
                var = to_unicode(var)
            if len(var) > 200:
                var = var[:200] + '...'
            return var

        reporter = ExceptionReporter(None, exc_type, exc_value, exc_traceback)
        frames = varmap(shorten, reporter.get_traceback_frames())

        if not kwargs.get('view'):
            # This should be cached
            modules = get_installed_apps()
            if settings.INCLUDE_PATHS:
                modules = set(list(modules) + settings.INCLUDE_PATHS)

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
            for frame in iter_tb_frames(exc_traceback):
                view = '.'.join([frame.f_globals['__name__'], frame.f_code.co_name])
                if contains(modules, view):
                    if not (contains(settings.EXCLUDE_PATHS, view) and best_guess):
                        best_guess = view
                elif best_guess:
                    break
            if best_guess:
                view = best_guess
            
            kwargs['view'] = view

        data = kwargs.pop('data', {}) or {}
        data['__sentry__'] = {
            'exc': map(to_unicode, [exc_type.__class__.__module__, exc_value.args, frames]),
        }

        if isinstance(exc_value, TemplateSyntaxError) and hasattr(exc_value, 'source'):
            origin, (start, end) = exc_value.source
            data['__sentry__'].update({
                'template': (origin.reload(), start, end, origin.name),
            })
            kwargs['view'] = origin.loadname
        
        tb_message = '\n'.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

        kwargs.setdefault('message', to_unicode(exc_value))

        return self.process(
            class_name=exc_type.__name__,
            traceback=tb_message,
            data=data,
            **kwargs
        )

