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

from django.conf import settings
from django.db import models
from django.conf import settings
from django.db.models import sql
from django.utils.hashcompat import md5_constructor
from django.utils.encoding import smart_unicode
from django.db.models.query import QuerySet
from django.views.debug import ExceptionReporter

DBLOG_DATABASE_USING = getattr(settings, 'DBLOG_DATABASE_USING', None)

assert not DBLOG_DATABASE_USING or django.VERSION >= (1, 2), 'The `DBLOG_DATABASE_USING` setting requires Django >= 1.2'

logger = logging.getLogger('dblog')

class DBLogManager(models.Manager):
    use_for_related_fields = True

    def get_query_set(self):
        qs = super(DBLogManager, self).get_query_set()
        if DBLOG_DATABASE_USING:
            qs = qs.using(DBLOG_DATABASE_USING)
        return qs

    def _create(self, **defaults):
        from models import Error, ErrorBatch
        
        server_name = socket.gethostname()
        class_name  = defaults.pop('class_name', None)
        checksum    = md5_constructor(str(defaults.get('level', logging.FATAL)))
        checksum.update(class_name or '')
        checksum.update(defaults.get('traceback') or defaults['message'])
        checksum    = checksum.hexdigest()

        data = defaults.pop('data', {})

        try:
            instance = Error.objects.create(
                class_name=class_name,
                server_name=server_name,
                data=data,
                **defaults
            )
            batch, created = ErrorBatch.objects.get_or_create(
                class_name = class_name,
                server_name = server_name,
                checksum = checksum,
                defaults = defaults
            )
            if not created:
                ErrorBatch.objects.filter(pk=batch.pk).update(
                    times_seen=models.F('times_seen') + 1,
                    status=0,
                    last_seen=datetime.datetime.now(),
                )
        except Exception:
            exc_info = sys.exc_info()
            logger.exception(exc_info[1], exc_info=exc_info)
        else:
            return instance
    
    def create_from_record(self, record, **kwargs):
        """
        Creates an error log for a `logging` module `record` instance.
        """
        for k in ('url',):
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
                for k, v in f.iteritems():
                    f[k] = to_unicode(v)
            elif isinstance(f, (list, tuple)):
                f = [to_unicode(f) for f in f]
            else:
                f = unicode(f)
            return f

        reporter = ExceptionReporter(None, exc_type, exc_value, traceback)
        frames = to_unicode(reporter.get_traceback_frames())

        data = kwargs.pop('data', {})
        data['exc'] = base64.b64encode(pickle.dumps([exc_type.__class__.__module__, exc_value.args, frames]))

        tb_message = '\n'.join(traceback_mod.format_exception(exc_type, exc_value, traceback))

        kwargs.setdefault('message', smart_unicode(exc_value))

        return self._create(
            class_name=exc_type.__name__,
            traceback=tb_message,
            data=data,
            **kwargs
        )