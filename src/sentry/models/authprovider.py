from __future__ import absolute_import, print_function

from bitfield import BitField
from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField,
    EncryptedJsonField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)


class AuthProvider(Model):
    __core__ = True

    organization = FlexibleForeignKey("sentry.Organization", unique=True)
    provider = models.CharField(max_length=128)
    config = EncryptedJsonField()

    date_added = models.DateTimeField(default=timezone.now)
    sync_time = BoundedPositiveIntegerField(null=True)
    last_sync = models.DateTimeField(null=True)

    default_role = BoundedPositiveIntegerField(default=50)
    default_global_access = models.BooleanField(default=True)
    # TODO(dcramer): ManyToMany has the same issue as ForeignKey and we need
    # to either write our own which works w/ BigAuto or switch this to use
    # through.
    default_teams = models.ManyToManyField("sentry.Team", blank=True)

    flags = BitField(
        flags=(("allow_unlinked", "Grant access to members who have not linked SSO accounts."),),
        default=0,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_authprovider"

    __repr__ = sane_repr("organization_id", "provider")

    def __unicode__(self):
        return self.provider

    def get_provider(self):
        from sentry.auth import manager

        return manager.get(self.provider, **self.config)

    def get_audit_log_data(self):
        return {"provider": self.provider, "config": self.config}
