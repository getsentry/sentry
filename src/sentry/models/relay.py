from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import Model, EncryptedTextField
from django.utils.functional import cached_property

import smith


class Relay(Model):
    __core__ = True

    relay_id = models.CharField(max_length=64, unique=True)

    # XXX: this does not need to be encrypted
    public_key = EncryptedTextField()
    first_seen = models.DateTimeField(default=timezone.now)
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_relay'

    @cached_property
    def public_key_object(self):
        return smith.PublicKey.parse(self.public_key)
