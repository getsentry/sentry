from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, region_silo_only_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.fields.jsonfield import JSONField


@region_silo_only_model
class AuthIdentityReplica(Model):
    __relocation_scope__ = RelocationScope.Excluded

    auth_identity_id = HybridCloudForeignKey(
        "sentry.AuthIdentity", on_delete="CASCADE", unique=True
    )
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    auth_provider_id = HybridCloudForeignKey("sentry.AuthProvider", on_delete="CASCADE")
    ident = models.CharField(max_length=128)
    data = JSONField()
    last_verified = models.DateTimeField(default=timezone.now)

    # This represents the time at which this model was created, NOT the date_added of the original auth identity
    # we are replicating from.
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_authidentityreplica"
        unique_together = (("auth_provider_id", "ident"), ("auth_provider_id", "user_id"))

    __repr__ = sane_repr("user_id", "auth_provider_id")

    def __str__(self):
        return self.ident

    def get_audit_log_data(self):
        return {"user_id": self.user_id, "data": self.data}
