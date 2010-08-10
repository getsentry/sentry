from django.conf import settings as dj_settings
from django.db import models, transaction
from django.core.signals import got_request_exception
from django.http import Http404
from django.utils.encoding import smart_unicode
from django.utils.translation import ugettext_lazy as _

from djangodblog import settings
from djangodblog.manager import DBLogManager
from djangodblog.utils import JSONDictField
from djangodblog.helpers import construct_checksum

import datetime
import warnings
import logging
import sys

try:
    from idmapper.models import SharedMemoryModel as Model
except ImportError:
    Model = models.Model

logger = logging.getLogger('dblog')

__all__ = ('Error', 'ErrorBatch')

LOG_LEVELS = (
    (logging.INFO, 'Info'),
    (logging.WARNING, 'Warning'),
    (logging.DEBUG, 'Debug'),
    (logging.ERROR, 'Error'),
    (logging.FATAL, 'Fatal'),
)

STATUS_LEVELS = (
    (0, 'Unresolved'),
    (1, 'Resolved'),
)

class ErrorBatch(Model):
    logger          = models.CharField(max_length=64, blank=True, default='root', db_index=True)
    class_name      = models.CharField(_('type'), max_length=128, blank=True, null=True, db_index=True)
    level           = models.PositiveIntegerField(choices=LOG_LEVELS, default=logging.ERROR, blank=True, db_index=True)
    message         = models.TextField()
    traceback       = models.TextField(blank=True, null=True)
    # XXX: We're using the legacy column for `is_resolved` for status
    status          = models.PositiveIntegerField(default=0, db_column="is_resolved", choices=STATUS_LEVELS)
    times_seen      = models.PositiveIntegerField(default=1)
    last_seen       = models.DateTimeField(default=datetime.datetime.now, db_index=True)
    first_seen      = models.DateTimeField(default=datetime.datetime.now, db_index=True)
    url             = models.URLField(verify_exists=False, null=True, blank=True)
    server_name     = models.CharField(max_length=128, db_index=True)
    checksum        = models.CharField(max_length=32, db_index=True)

    objects         = DBLogManager()

    class Meta:
        unique_together = (('logger', 'server_name', 'checksum'),)
        verbose_name_plural = 'Message summaries'
        verbose_name = 'Message summary'
    
    def __unicode__(self):
        return "(%s) %s: %s" % (self.times_seen, self.class_name, self.error())
    
    def shortened_url(self):
        if not self.url:
            return '(No URL)'
        url = self.url
        if len(url) > 60:
            url = url[:60] + '...'
        return url
    shortened_url.short_description = 'URL'
    shortened_url.admin_order_field = 'url'
    
    def full_url(self):
        return self.data.get('url') or self.url
    full_url.short_description = 'URL'
    full_url.admin_order_field = 'url'
    
    def error(self):
        message = smart_unicode(self.message)
        if len(message) > 100:
            message = message[:97] + '...'
        if self.class_name:
            return "%s: %s" % (self.class_name, message)
        return message
    error.short_description = 'Error'

    def get_absolute_url(self):
        return self.url

    @staticmethod
    @transaction.commit_on_success
    def handle_exception(sender, request=None, **kwargs):
        try:
            exc_type, exc_value, traceback = sys.exc_info()
        
            if not settings.CATCH_404_ERRORS \
                    and issubclass(exc_type, Http404):
                return

            if dj_settings.DEBUG or getattr(exc_type, 'skip_dblog', False):
                return

            if transaction.is_dirty():
                transaction.rollback()

            if request:
                data = dict(
                    META=request.META,
                    POST=request.POST,
                    GET=request.GET,
                    COOKIES=request.COOKIES,
                )
            else:
                data = dict()

            extra = dict(
                url=request and request.build_absolute_uri() or None,
                data=data,
            )

            if settings.USE_LOGGING:
                logging.getLogger('dblog').critical(exc_value, exc_info=sys.exc_info(), extra=extra)
            else:
                Error.objects.create_from_exception(**extra)
        except Exception, exc:
            try:
                logger.exception(u'Unable to process log entry: %s' % (exc,))
            except Exception, exc:
                warnings.warn(u'Unable to process log entry: %s' % (exc,))

class Error(Model):
    logger          = models.CharField(max_length=64, blank=True, default='root', db_index=True)
    class_name      = models.CharField(_('type'), max_length=128, blank=True, null=True, db_index=True)
    level           = models.PositiveIntegerField(choices=LOG_LEVELS, default=logging.ERROR, blank=True, db_index=True)
    message         = models.TextField()
    traceback       = models.TextField(blank=True, null=True)
    datetime        = models.DateTimeField(default=datetime.datetime.now, db_index=True)
    url             = models.URLField(verify_exists=False, null=True, blank=True)
    data            = JSONDictField(blank=True, null=True)
    server_name     = models.CharField(max_length=128, db_index=True)
    checksum        = models.CharField(max_length=32, db_index=True, null=True)

    objects         = DBLogManager()

    class Meta:
        verbose_name = 'Message'
        verbose_name_plural = 'Messages'

    def __unicode__(self):
        return "%s: %s" % (self.class_name, smart_unicode(self.message))

    def shortened_url(self):
        if not self.url:
            return '(No URL)'
        url = self.url
        if len(url) > 60:
            url = url[:60] + '...'
        return url
    shortened_url.short_description = 'URL'
    shortened_url.admin_order_field = 'url'
    
    def full_url(self):
        return self.data.get('url') or self.url
    full_url.short_description = 'URL'
    full_url.admin_order_field = 'url'

    def error(self):
        message = smart_unicode(self.message)
        if len(message) > 100:
            message = message[:97] + '...'
        if self.class_name:
            return "%s: %s" % (self.class_name, message)
        return message
    error.short_description = 'Error'

    def get_absolute_url(self):
        return self.url
    
    def save(self, *args, **kwargs):
        if not self.checksum:
            self.checksum = construct_checksum(self)
        super(Error, self).save(*args, **kwargs)

   
got_request_exception.connect(ErrorBatch.handle_exception)