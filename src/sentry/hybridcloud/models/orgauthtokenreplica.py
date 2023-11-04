from __future__ import annotations

from django.db import models
from django.utils import timezone
from django.utils.encoding import force_str

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    ArrayField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.orgauthtoken import MAX_NAME_LENGTH


@region_silo_only_model
class OrgAuthTokenReplica(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", null=False, on_delete=models.CASCADE)
    orgauthtoken_id = HybridCloudForeignKey("sentry.OrgAuthToken", null=False, on_delete="cascade")
    # The JWT token in hashed form
    token_hashed = models.TextField(null=False)
    name = models.CharField(max_length=MAX_NAME_LENGTH, null=False, blank=False)
    scope_list = ArrayField(models.TextField())
    created_by_id = HybridCloudForeignKey(
        "sentry.User", null=True, blank=True, on_delete="set_null"
    )
    date_added = models.DateTimeField(default=timezone.now, null=False)
    date_deactivated = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "hybridcloud"
        db_table = "hybridcloud_orgauthtokenreplica"

    __repr__ = sane_repr("organization_id", "token_hashed")

    def __str__(self):
        return force_str(self.token_hashed)

    @property
    def entity_id(self) -> int:
        return self.orgauthtoken_id

    def get_audit_log_data(self):
        return {"name": self.name, "scopes": self.get_scopes()}

    def get_allowed_origins(self):
        return []

    def get_scopes(self):
        return self.scope_list

    def has_scope(self, scope):
        return scope in self.get_scopes()

    def is_active(self) -> bool:
        return self.date_deactivated is None
