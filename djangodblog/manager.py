# Multi-db support based on http://www.eflorenzano.com/blog/post/easy-multi-database-support-django/
# TODO: is there a way to use the traceback module based on an exception variable?

from django.conf import settings
from django.db import models
from django.conf import settings
from django.db.models import sql
from django.utils.hashcompat import md5_constructor
from django.utils.encoding import smart_unicode
from django.db.models.query import QuerySet

import traceback
import logging
import socket
import warnings
import datetime
import django

DBLOG_DATABASE_USING = getattr(settings, 'DBLOG_DATABASE_USING', None)

assert not DBLOG_DATABASE_USING or django.VERSION >= (1, 2), 'The `DBLOG_DATABASE_USING` setting requires Django >= 1.2'

class DBLogManager(models.Manager):
    use_for_related_fields = True
    
    def _get_settings(self):
        options = getattr(settings, 'DBLOG_DATABASE', None)
        if options:
            if 'DATABASE_PORT' not in options:
                options['DATABASE_PORT'] = ''
            if 'DATABASE_OPTIONS' not in options:
                options['DATABASE_OPTIONS'] = {}
        return options

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
                batch.times_seen += 1
                batch.status = 0
                batch.last_seen = datetime.datetime.now()
                batch.save()
        except Exception, exc:
            warnings.warn(smart_unicode(exc))
        else:
            return instance
    
    def create_from_record(self, record, **kwargs):
        """
        Creates an error log for a `logging` module `record` instance.
        """
        return self._create(
            logger=record.name,
            level=record.levelno,
            traceback=record.exc_text,
            message=record.getMessage(),
            **kwargs
        )

    def create_from_text(self, message, **kwargs):
        """
        Creates an error log for from `type` and `message`.
        """
        return self._create(
            message=message,
            **kwargs
        )
    
    def create_from_exception(self, exception, **kwargs):
        """
        Creates an error log from an `exception` instance.
        """
        return self._create(
            class_name=exception.__class__.__name__,
            traceback=traceback.format_exc(),
            message=smart_unicode(exception),
            **kwargs
        )