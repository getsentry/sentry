from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField, FlexibleForeignKey, GzippedDictField, Model
)

from .organizationmember import OrganizationMember


_organizationemmber_type_field = OrganizationMember._meta.get_field('type')


class AuthProvider(Model):
    provider = models.CharField(max_length=128)
    config = GzippedDictField()

    created_by = FlexibleForeignKey('sentry.User', null=True, on_delete=models.SET_NULL)
    date_added = models.DateTimeField(default=timezone.now)
    sync_time = BoundedPositiveIntegerField(null=True)
    last_sync = models.DateTimeField(null=True)

    default_role = BoundedPositiveIntegerField(
        choices=_organizationemmber_type_field.choices,
        default=_organizationemmber_type_field.default
    )

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_authprovider'

    def get_provider(self):
        from sentry.auth import manager

        return manager.get(self.provider, **self.config)
