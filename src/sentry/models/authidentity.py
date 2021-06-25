from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import EncryptedJsonField, FlexibleForeignKey, Model, sane_repr


class AuthIdentity(Model):
    __include_in_export__ = True

    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    auth_provider = FlexibleForeignKey("sentry.AuthProvider")
    ident = models.CharField(max_length=128)
    data = EncryptedJsonField()
    last_verified = models.DateTimeField(default=timezone.now)
    last_synced = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_authidentity"
        unique_together = (("auth_provider", "ident"), ("auth_provider", "user"))

    __repr__ = sane_repr("user_id", "auth_provider_id")

    def __str__(self):
        return self.ident

    def get_audit_log_data(self):
        return {"user_id": self.user_id, "data": self.data}

    # TODO(dcramer): we'd like to abstract this so there's a central Role object
    # and it doesnt require two composite db objects to talk to each other
    def is_valid(self, member):
        if getattr(member.flags, "sso:invalid"):
            return False
        if not getattr(member.flags, "sso:linked"):
            return False

        if not self.last_verified:
            return False
        if self.last_verified < timezone.now() - timedelta(hours=24):
            return False
        return True

    def get_display_name(self):
        return self.user.get_display_name()

    def get_label(self):
        return self.user.get_label()
