from datetime import timedelta

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, region_silo_only_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.fields.jsonfield import JSONField


@region_silo_only_model
class RegionReplicatedAuthIdentity(Model):
    __relocation_scope__ = RelocationScope.Organization

    # NOTE: not a fk to sentry user
    user = HybridCloudForeignKey("sentry.User", on_delete="cascade")
    auth_provider = HybridCloudForeignKey("sentry.AuthProvider", on_delete="cascade")
    ident = models.CharField(max_length=128)
    data = JSONField()

    # This represents the time at which this model was created, NOT the date_added of the original auth identity
    # we are replicating from.
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_regionreplicatedauthidentity"
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
