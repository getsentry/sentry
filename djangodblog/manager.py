# Multi-db support based on http://www.eflorenzano.com/blog/post/easy-multi-database-support-django/
# TODO: is there a way to use the traceback module based on an exception variable?

import traceback as traceback_mod
import logging
import socket
import warnings
import datetime
import django
import base64
import sys
try:
    import cPickle as pickle
except ImportError:
    import pickle

from django.core.cache import cache
from django.db import models
from django.utils.encoding import smart_unicode
from django.views.debug import ExceptionReporter

from djangodblog import settings
from djangodblog.helpers import construct_checksum

assert not settings.DATABASE_USING or django.VERSION >= (1, 2), 'The `DBLOG_DATABASE_USING` setting requires Django >= 1.2'

logger = logging.getLogger('dblog')

class DBLogManager(models.Manager):
    use_for_related_fields = True

    def get_query_set(self):
        qs = super(DBLogManager, self).get_query_set()
        if settings.DATABASE_USING:
            qs = qs.using(settings.DATABASE_USING)
        return qs

    def _create(self, **defaults):
        from models import Error, ErrorBatch
        
        URL_MAX_LENGTH = Error._meta.get_field_by_name('url')[0].max_length
        
        server_name = socket.gethostname()
        class_name  = defaults.pop('class_name', None)
        
        data = defaults.pop('data', {}) or {}
        if defaults.get('url'):
            data['url'] = defaults['url']
            defaults['url'] = defaults['url'][:URL_MAX_LENGTH]

        instance = Error(
            class_name=class_name,
            server_name=server_name,
            data=data,
            **defaults
        )
        instance.checksum = construct_checksum(instance)
        
        if settings.THRASHING_TIMEOUT and settings.THRASHING_LIMIT:
            cache_key = 'djangodblog:%s:%s' % (instance.class_name, instance.checksum)
            added = cache.add(cache_key, 1, settings.THRASHING_TIMEOUT)
            if not added and cache.incr(cache_key) > settings.THRASHING_LIMIT:
                return

        try:
            instance.save()
            batch, created = ErrorBatch.objects.get_or_create(
                class_name = class_name,
                server_name = server_name,
                checksum = instance.checksum,
                defaults = defaults
            )
            if not created:
                ErrorBatch.objects.filter(pk=batch.pk).update(
                    times_seen=models.F('times_seen') + 1,
                    status=0,
                    last_seen=datetime.datetime.now(),
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
        for k in ('url', 'data'):
            if k not in kwargs:
                kwargs[k] = record.__dict__.get(k)
        kwargs.update({
            'logger': record.name,
            'level': record.levelno,
            'message': record.getMessage(),
        })
        if record.exc_info:
            return self.create_from_exception(*record.exc_info[1:2], **kwargs)

        return self._create(
            traceback=record.exc_text,
            **kwargs
        )

    def create_from_text(self, message, **kwargs):
        """
        Creates an error log for from ``type`` and ``message``.
        """
        return self._create(
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

        reporter = ExceptionReporter(None, exc_type, exc_value, traceback)
        frames = reporter.get_traceback_frames()

        data = kwargs.pop('data', {}) or {}
        data['exc'] = base64.b64encode(pickle.dumps(map(to_unicode, [exc_type.__class__.__module__, exc_value.args, frames])).encode('zlib'))

        tb_message = '\n'.join(traceback_mod.format_exception(exc_type, exc_value, traceback))

        kwargs.setdefault('message', to_unicode(exc_value))

        return self._create(
            class_name=exc_type.__name__,
            traceback=tb_message,
            data=data,
            **kwargs
        )

class ErrorBatchManager(DBLogManager):
    def get_by_natural_key(self, logger, server_name, checksum):
        return self.get(logger=logger, server_name=server_name, checksum=checksum)