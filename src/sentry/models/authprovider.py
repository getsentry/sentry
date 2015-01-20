from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField, GzippedDictField, Model
)


class AuthProvider(Model):
    provider = models.CharField(max_length=128)
    config = GzippedDictField()

    created_by = models.ForeignKey('sentry.User')
    date_added = models.DateTimeField(default=timezone.now)
    sync_time = BoundedPositiveIntegerField(null=True)
    last_sync = models.DateTimeField(null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_authprovider'

    def get_provider(self):
        from sentry.auth import manager

        return manager.get(self.provider)
