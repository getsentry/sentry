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
    actor_label = models.CharField(max_length=64, null=True, blank=True)
    # if the entry was created via a user
    actor = FlexibleForeignKey('sentry.User', related_name='audit_actors', null=True, blank=True)
    # if the entry was created via an api key
    actor_key = FlexibleForeignKey('sentry.ApiKey', null=True, blank=True)

    ip_address = models.GenericIPAddressField(null=True, unpack_ipv4=True)
    date_deleted = models.DateTimeField(default=timezone.now)
    # Would knowing when it was created be useful?
    date_created = models.DateTimeField()

    reason = models.TextField(blank=True, null=True)

    class Meta:
        abstract = True
