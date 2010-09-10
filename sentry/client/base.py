import base64
try:
    import cPickle as pickle
except ImportError:
    import pickle
import logging
import socket
import sys
import traceback as traceback_mod
import urllib
import urllib2
import warnings

from django.core.cache import cache
from django.template import TemplateSyntaxError
from django.utils.encoding import smart_unicode
from django.views.debug import ExceptionReporter

from sentry import settings
from sentry.helpers import construct_checksum, varmap, transform

logger = logging.getLogger('sentry')

class SentryClient(object):
    def process(self, **kwargs):
        from sentry.helpers import get_filters

        for filter_ in get_filters():
            kwargs = filter_(None).process(kwargs) or kwargs

        kwargs.setdefault('level', logging.ERROR)
        kwargs.setdefault('server_name', socket.gethostname())

        checksum = construct_checksum(**kwargs)

        if settings.THRASHING_TIMEOUT and settings.THRASHING_LIMIT:
            cache_key = 'sentry:%s:%s' % (kwargs.get('class_name'), checksum)
            added = cache.add(cache_key, 1, settings.THRASHING_TIMEOUT)
            if not added and cache.incr(cache_key) > settings.THRASHING_LIMIT:
                return

        return self.send(**kwargs)

    def send(self, **kwargs):
        if settings.REMOTE_URL:
            data = {
                'data': base64.b64encode(pickle.dumps(transform(kwargs)).encode('zlib')),
                'key': settings.KEY,
            }
            req = urllib2.Request(settings.REMOTE_URL, urllib.urlencode(data))

            try:
                response = urllib2.urlopen(req, None, settings.REMOTE_TIMEOUT).read()
            except urllib2.URLError, e:
                logger.exception('Unable to reach Sentry log server')
            except urllib2.HTTPError, e:
                logger.exception('Unable to reach Sentry log server', extra={'body': e.read()})
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
            return self.create_from_exception(*record.exc_info[1:2], **kwargs)

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

    def create_from_exception(self, exception=None, traceback=None, **kwargs):
        """
        Creates an error log from an exception.
        """
        if not exception:
            exc_type, exc_value, traceback = sys.exc_info()
        elif not traceback:
            warnings.warn('Using just the ``exception`` argument is deprecated, send ``traceback`` in addition.', DeprecationWarning)
            exc_type, exc_value, traceback = sys.exc_info()
        else:
            exc_type = exception.__class__
            exc_value = exception

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
            return f

        def shorten(var):
            if not isinstance(var, basestring):
                var = to_unicode(var)
            if len(var) > 500:
                var = var[:500] + '...'
            return var

        reporter = ExceptionReporter(None, exc_type, exc_value, traceback)
        frames = varmap(shorten, reporter.get_traceback_frames())

        data = kwargs.pop('data', {}) or {}
        data['__sentry__'] = {
            'exc': map(to_unicode, [exc_type.__class__.__module__, exc_value.args, frames]),
        }

        if isinstance(exc_value, TemplateSyntaxError) and hasattr(exc_value, 'source'):
            origin, (start, end) = exc_value.source
            data['__sentry__'].update({
                'template': (origin.reload(), start, end, origin.name),
            })
        
        tb_message = '\n'.join(traceback_mod.format_exception(exc_type, exc_value, traceback))

        kwargs.setdefault('message', to_unicode(exc_value))

        return self.process(
            class_name=exc_type.__name__,
            traceback=tb_message,
            data=data,
            **kwargs
        )