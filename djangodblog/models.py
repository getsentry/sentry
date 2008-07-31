from django.db import models
from django.utils.translation import ugettext_lazy as _

import datetime

__all__ = ('Error', 'ErrorBatch')

class ErrorBatch(models.Model):
    class_name      = models.CharField(_('Type'), max_length=128)
    message         = models.TextField()
    traceback       = models.TextField()
    is_resolved     = models.BooleanField(default=False)
    times_seen      = models.PositiveIntegerField(default=1)
    last_seen       = models.DateTimeField(default=datetime.datetime.now)
    first_seen      = models.DateTimeField(default=datetime.datetime.now)
    url             = models.URLField(verify_exists=False, null=True, blank=True)
    server_name     = models.CharField(max_length=128, db_index=True)
    checksum        = models.CharField(max_length=32, db_index=True)

    class Admin:
        list_display    = ('class_name', 'message', 'is_resolved', 'last_seen', 'times_seen', 'url', 'server_name')
        list_filter     = ('class_name', 'times_seen', 'server_name', 'is_resolved')
        ordering        = ('-last_seen',)
        
    class Meta:
        unique_together = (('class_name', 'server_name', 'checksum'),)

class Error(models.Model):
    class_name      = models.CharField(_('type'), max_length=128)
    message         = models.TextField()
    traceback       = models.TextField()
    datetime        = models.DateTimeField(default=datetime.datetime.now)
    url             = models.URLField(verify_exists=False, null=True, blank=True)
    server_name     = models.CharField(max_length=128, db_index=True)
    
    class Admin:
        list_display    = ('class_name', 'message', 'datetime', 'url', 'server_name')
        list_filter     = ('class_name', 'datetime', 'server_name')
        ordering        = ('-datetime',)