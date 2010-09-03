# Multi-db support based on http://www.eflorenzano.com/blog/post/easy-multi-database-support-django/
# TODO: is there a way to use the traceback module based on an exception variable?

import base64
try:
    import cPickle as pickle
except ImportError:
    import pickle
import datetime
import django
import logging
import socket
import sys
import traceback as traceback_mod
import urllib
import urllib2
import warnings

from django.core.cache import cache
from django.db import models
from django.db.models import signals
from django.template import TemplateSyntaxError
from django.utils.encoding import smart_unicode
from django.views.debug import ExceptionReporter

from sentry import settings
from sentry.helpers import construct_checksum, varmap
from sentry.utils import transform

assert not settings.DATABASE_USING or django.VERSION >= (1, 2), 'The `SENTRY_DATABASE_USING` setting requires Django >= 1.2'

logger = logging.getLogger('sentry')

class SentryManager(models.Manager):
    use_for_related_fields = True

    def get_query_set(self):
        qs = super(SentryManager, self).get_query_set()
        if settings.DATABASE_USING:
            qs = qs.using(settings.DATABASE_USING)
        return qs

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

        if settings.REMOTE_URL:
            data = {
                'data': base64.b64encode(pickle.dumps(transform(kwargs))).encode('zlib'),
                'key': settings.KEY,
            }
            req = urllib2.Request(settings.REMOTE_URL, urllib.urlencode(data))

            try:
                response = urllib2.urlopen(req).read()
            except urllib2.HTTPError, e:
                logger.exception('Unable to reach Sentry log server')
        return self._create(**kwargs)

    def _create(self, **kwargs):
        from sentry.models import Message, GroupedMessage
        
        URL_MAX_LENGTH = Message._meta.get_field_by_name('url')[0].max_length
        now = datetime.datetime.now()

        view = kwargs.pop('view', None)
        logger_name = kwargs.pop('logger', 'root')
        url = kwargs.pop('url', None)
        server_name = kwargs.pop('server_name', )
        data = kwargs.pop('data', {}) or {}

        if url:
            data['url'] = url
            url = url[:URL_MAX_LENGTH]

        checksum = construct_checksum(**kwargs)

        try:
            group, created = GroupedMessage.objects.get_or_create(
                view=view,
                logger=logger_name,
                checksum=checksum,
                defaults=kwargs
            )
            if not created:
                GroupedMessage.objects.filter(pk=group.pk).update(
                    times_seen=models.F('times_seen') + 1,
                    status=0,
                    last_seen=now,
                )
                # HACK: maintain appeared state
                group.status = 0
                group.last_seen = now
                group.times_seen += 1
                signals.post_save.send(sender=GroupedMessage, instance=group, created=False)

            instance = Message.objects.create(
                view=view,
                logger=logger_name,
                data=data,
                url=url,
                server_name=server_name,
                checksum=checksum,
                group=group,
                **kwargs
            )
        except Exception, exc:
            try:
                logger.exception(u'Unable to process log entry: %s' % (exc,))
            except Exception, exc:
                warnings.warn(u'Unable to process log entry: %s' % (exc,))
        else:
            return instance
    
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

class GroupedMessageManager(SentryManager):
    def get_by_natural_key(self, logger, view, checksum):
        return self.get(logger=logger, view=view, checksum=checksum)