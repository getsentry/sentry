from __future__ import absolute_import
from django.db import models
from django.utils import timezone

from sentry.db.models import (
    Model, FlexibleForeignKey
)

# Should we use python logger as well?
import logging
audit_logger = logging.getLogger('sentry.audit.deleted')


class DeletedEntry(Model):
    # Can't find documentation as to what this means?
    __core__ = False

    # actor_label = models.CharField(max_length=64, null=True, blank=True)
    # if the entry was created via a user
    deletor = FlexibleForeignKey(
        'sentry.User',
        # needed see
        # https://docs.djangoproject.com/en/1.10/topics/db/models/#be-careful-with-related-name-and-related-query-name
        related_name='deleted_%(class)s',
        null=True,
        blank=True)
    # if the entry was created via an api key
    deletor_key = FlexibleForeignKey('sentry.ApiKey', null=True, blank=True)

    ip_address = models.GenericIPAddressField(null=True, unpack_ipv4=True)
    date_deleted = models.DateTimeField(default=timezone.now)
    # Would knowing when it was created be useful?
    date_created = models.DateTimeField()

    reason = models.TextField(blank=True, null=True)

    class Meta:
        abstract = True
