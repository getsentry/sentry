from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, control_silo_model, sane_repr


@control_silo_model
class PendingUser(DefaultFieldsModel):
    """
    Temporary record holding signup form data while a user verifies their email.

    The password field stores a hash produced by django.contrib.auth.hashers.make_password().
    On successful verification, the hash is copied directly to User.password — no rehashing needed.
    Records are deleted after conversion or upon expiry.
    """

    __relocation_scope__ = RelocationScope.Excluded

    email = models.EmailField(max_length=200, unique=True)
    name = models.CharField(max_length=200)
    password = models.CharField(max_length=128)
    organization_name = models.CharField(max_length=64, blank=True, db_default="")
    data_storage_location = models.CharField(max_length=10, blank=True, db_default="")
    subscribe = models.BooleanField(db_default=False)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pendinguser"

    __repr__ = sane_repr("email")
