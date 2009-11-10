from django.db import models
from django.conf import settings
from django.utils.translation import ugettext_lazy as _

try:
    from idmapper.models import SharedMemoryModel as Model
except ImportError:
    Model = models.Model

import datetime

from manager import DBLogManager

__all__ = ('Error', 'ErrorBatch')

import logging

LOG_LEVELS = (
    ('Info', logging.INFO),
    ('Warning', logging.WARNING),
    ('Debug', logging.DEBUG),
    ('Error', logging.ERROR),
    ('Fatal', logging.FATAL),
)

STATUS_LEVELS = (
    ('Unresolved', 0),
    ('Resolved', 1),
)

class ErrorBatch(Model):
    class_name      = models.CharField(_('type'), max_length=128)
    level           = models.PositiveIntegerField(choices=LOG_LEVELS, default=logging.ERROR, blank=True)
    message         = models.TextField()
    traceback       = models.TextField(blank=True, null=True)
    # XXX: We're using the legacy column for `is_resolved` for status
    status          = models.PositiveIntegerField(default=0, db_column="is_resolved")
    times_seen      = models.PositiveIntegerField(default=1)
    last_seen       = models.DateTimeField(default=datetime.datetime.now)
    first_seen      = models.DateTimeField(default=datetime.datetime.now)
    url             = models.URLField(verify_exists=False, null=True, blank=True)
    server_name     = models.CharField(max_length=128, db_index=True)
    checksum        = models.CharField(max_length=32, db_index=True)

    objects         = DBLogManager()

    class Meta:
        unique_together = (('class_name', 'server_name', 'checksum'),)
        verbose_name_plural = 'Error batches'
    
    def __unicode__(self):
        return "(%s) %s: %s" % (self.times_seen, self.class_name, self.message)

class Error(Model):
    class_name      = models.CharField(_('type'), max_length=128)
    level           = models.PositiveIntegerField(choices=LOG_LEVELS, default=logging.FATAL, blank=True)
    message         = models.TextField()
    traceback       = models.TextField(blank=True, null=True)
    datetime        = models.DateTimeField(default=datetime.datetime.now)
    url             = models.URLField(verify_exists=False, null=True, blank=True)
    server_name     = models.CharField(max_length=128, db_index=True)

    objects         = DBLogManager()

    def __unicode__(self):
        return "%s: %s" % (self.class_name, self.message)