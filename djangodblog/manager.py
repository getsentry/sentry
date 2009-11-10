# Multi-db support based on http://www.eflorenzano.com/blog/post/easy-multi-database-support-django/
# TODO: is there a way to use the traceback module based on an exception variable?

from django.conf import settings
from django.core import signals
from django.db import models
from django.conf import settings
from django.db.models import sql
from django.db.transaction import savepoint_state
from django.utils.hashcompat import md5_constructor
from django.utils.encoding import smart_unicode
from django.db.models.sql import BaseQuery
from django.db.models.query import QuerySet

try:
    import thread
except ImportError:
    import dummy_thread as thread
import traceback
import logging
import socket
import warnings
import datetime
import django

django_is_10 = django.VERSION < (1, 1)

"""
``DBLOG_DATABASE`` allows you to use a secondary database for error logging::

    DBLOG_DATABASE = dict(
        DATABASE_ENGINE='mysql', # defaults to settings.DATABASE_ENGINE
        DATABASE_NAME='my_db_name',
        DATABASE_USER='db_user',
        DATABASE_PASSWORD='db_pass',
        DATABASE_HOST='localhost', # defaults to localhost
        DATABASE_PORT='', # defaults to [default port]
        DATABASE_OPTIONS={}
    )
    
Note: You will need to create the tables by hand if you use this option.
"""

assert(not getattr(settings, 'DBLOG_DATABASE', None) or django.VERSION < (1, 2), 'The `DBLOG_DATABASE` setting requires Django < 1.2')

_connection = None
def close_connection(**kwargs):
    global _connection
    if _connection is None:
        return
    _connection.close()
    _connection = None
signals.request_finished.connect(close_connection)

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
        db_options = self._get_settings()
        if not db_options:
            return super(DBLogManager, self).get_query_set()
        connection = self.get_db_wrapper(db_options)
        
        if connection.features.uses_custom_query_class:
            Query = connection.ops.query_class(BaseQuery)
        else:
            Query = BaseQuery
        return QuerySet(self.model, Query(self.model, connection))

    def get_db_wrapper(self, options):
        global _connection
        if _connection is None:
            backend = __import__('django.db.backends.' + options.get('DATABASE_ENGINE', settings.DATABASE_ENGINE)
                + ".base", {}, {}, ['base'])
            if django_is_10:
                backup = {}
                for key, value in options.iteritems():
                    backup[key] = getattr(settings, key)
                    setattr(settings, key, value)
            _connection = backend.DatabaseWrapper(options)
            # if django_is_10:
            #     connection._cursor(settings)
            # else:
            #     connection._cursor()
            if django_is_10:
                for key, value in backup.iteritems():
                    setattr(settings, key, value)
        return _connection

    def _insert(self, values, return_id=False, raw_values=False):
        db_options = self._get_settings()
        if not db_options:
            return super(DBLogManager, self)._insert(values, return_id=return_id, raw_values=raw_values)

        query = sql.InsertQuery(self.model, self.get_db_wrapper(db_options))
        query.insert_values(values, raw_values)
        ret = query.execute_sql(return_id)
        # XXX: Why is the following needed?
        query.connection._commit()
        thread_ident = thread.get_ident()
        if thread_ident in savepoint_state:
            del savepoint_state[thread_ident]
        return ret

    def _create(self, **defaults):
        from models import Error, ErrorBatch
        
        server_name = socket.gethostname()
        class_name  = defaults.pop('class_name', None)
        checksum    = md5_constructor(str(defaults.get('level', logging.FATAL)))
        checksum.update(class_name or '')
        checksum.update(defaults.get('traceback') or defaults['message'])
        checksum    = checksum.hexdigest()

        try:
            instance = Error.objects.create(
                class_name=class_name,
                server_name=server_name,
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