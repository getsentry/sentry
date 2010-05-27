from django.db import models
from django.utils.translation import ugettext_lazy as _

try:
    from idmapper.models import SharedMemoryModel as Model
except ImportError:
    Model = models.Model

import datetime

from djangodblog.manager import DBLogManager
from djangodblog.utils import JSONDictField

__all__ = ('Error', 'ErrorBatch')

import logging

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
    last_seen       = models.DateTimeField(default=datetime.datetime.now)
    first_seen      = models.DateTimeField(default=datetime.datetime.now)
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
    shortened_url.short_description = "URL"
    shortened_url.admin_order_field = 'url'

    def error(self):
        message = self.message
        if len(message) > 100:
            message = message[:97] + '...'
        if self.class_name:
            return "%s: %s" % (self.class_name, message)
        return message
    error.short_description = 'Error'

    def get_absolute_url(self):
        return self.url

class Error(Model):
    logger          = models.CharField(max_length=64, blank=True, default='root', db_index=True)
    class_name      = models.CharField(_('type'), max_length=128, blank=True, null=True)
    level           = models.PositiveIntegerField(choices=LOG_LEVELS, default=logging.ERROR, blank=True, db_index=True)
    message         = models.TextField()
    traceback       = models.TextField(blank=True, null=True)
    datetime        = models.DateTimeField(default=datetime.datetime.now)
    url             = models.URLField(verify_exists=False, null=True, blank=True)
    data            = JSONDictField(blank=True, null=True)
    server_name     = models.CharField(max_length=128, db_index=True)

    objects         = DBLogManager()

    class Meta:
        verbose_name = 'Message'
        verbose_name_plural = 'Messages'

    def __unicode__(self):
        return "%s: %s" % (self.class_name, self.message)

    def shortened_url(self):
        if not self.url:
            return '(No URL)'
        url = self.url
        if len(url) > 60:
            url = url[:60] + '...'
        return url
    shortened_url.short_description = "URL"
    shortened_url.admin_order_field = 'url'

    def error(self):
        message = self.message
        if len(message) > 100:
            message = message[:97] + '...'
        if self.class_name:
            return "%s: %s" % (self.class_name, message)
        return message
    error.short_description = 'Error'

    def get_absolute_url(self):
        return self.url