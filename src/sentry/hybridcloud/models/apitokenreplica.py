from django.db import models
from django.utils import timezone
from django.utils.encoding import force_str

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_only_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.apiscopes import HasApiScopes


@region_silo_only_model
class ApiTokenReplica(Model, HasApiScopes):
    __relocation_scope__ = RelocationScope.Excluded

    application_id = HybridCloudForeignKey("sentry.ApiApplication", null=True, on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization", null=True, on_delete=models.SET_NULL)
    application_is_active = models.BooleanField(default=False)
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    apitoken_id = HybridCloudForeignKey("sentry.ApiToken", null=False, on_delete="CASCADE")
    token = models.CharField(max_length=64)
    expires_at = models.DateTimeField(null=True)
    allowed_origins = models.TextField(blank=True, null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_apitokenreplica"

    __repr__ = sane_repr("user_id", "token", "application_id")

    def __str__(self):
        return force_str(self.token)

    @property
    def entity_id(self) -> int:
        return self.apitoken_id

    def is_expired(self):
        if not self.expires_at:
            return False

        return timezone.now() >= self.expires_at

    def get_allowed_origins(self):
        if not self.allowed_origins:
            return []
        return [origin for origin in self.allowed_origins.split()]

    def get_audit_log_data(self):
        return {"scopes": self.get_scopes()}
