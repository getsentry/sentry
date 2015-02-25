from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, GzippedDictField, Model


class AuthIdentity(Model):
    user = FlexibleForeignKey('sentry.User')
    auth_provider = FlexibleForeignKey('sentry.AuthProvider')
    ident = models.CharField(max_length=128)
    data = GzippedDictField()
    last_verified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_authidentity'
        unique_together = (('auth_provider', 'ident'), ('auth_provider', 'user'))

    def get_audit_log_data(self):
        return {
            'user_id': self.user_id,
            'data': self.data,
        }
