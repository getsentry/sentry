from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.apikey import ApiKeyStatus
from sentry.models.apiscopes import HasApiScopes


@region_silo_only_model
class ApiKeyReplica(Model, HasApiScopes):
    __relocation_scope__ = RelocationScope.Excluded

    apikey_id = HybridCloudForeignKey("sentry.ApiKey", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    label = models.CharField(max_length=64, blank=True)
    # Not unique to simplify replication -- use last()
    key = models.CharField(max_length=32)
    status = BoundedPositiveIntegerField(db_index=True)
    date_added = models.DateTimeField(default=timezone.now)
    allowed_origins = models.TextField(blank=True, null=True)

    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_apikeyreplica"

    __repr__ = sane_repr("organization_id", "key")

    @property
    def entity_id(self) -> int:
        return self.apikey_id

    @property
    def is_active(self):
        return self.status == ApiKeyStatus.ACTIVE

    def get_allowed_origins(self):
        if not self.allowed_origins:
            return []
        return list(filter(bool, self.allowed_origins.split("\n")))

    def get_audit_log_data(self):
        return {
            "label": self.label,
            "key": self.key,
            "scopes": self.get_scopes(),
            "status": self.status,
        }
