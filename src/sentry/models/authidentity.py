from typing import Collection

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, control_silo_only_model, sane_repr
from sentry.db.models.fields.jsonfield import JSONField
from sentry.db.models.outboxes import ReplicatedControlModel
from sentry.models.outbox import OutboxCategory
from sentry.types.region import find_regions_for_orgs


@control_silo_only_model
class AuthIdentity(ReplicatedControlModel):
    __relocation_scope__ = RelocationScope.Global
    category = OutboxCategory.AUTH_IDENTITY_UPDATE
    replication_version = 2

    # NOTE: not a fk to sentry user
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    auth_provider = FlexibleForeignKey("sentry.AuthProvider")
    ident = models.CharField(max_length=128)
    data = JSONField()
    last_verified = models.DateTimeField(default=timezone.now)
    last_synced = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    def outbox_region_names(self) -> Collection[str]:
        return find_regions_for_orgs([self.auth_provider.organization_id])

    def handle_async_replication(self, region_name: str, shard_identifier: int) -> None:
        from sentry.services.hybrid_cloud.auth.serial import serialize_auth_identity
        from sentry.services.hybrid_cloud.replica.service import region_replica_service

        serialized = serialize_auth_identity(self)
        region_replica_service.upsert_replicated_auth_identity(
            auth_identity=serialized, region_name=region_name
        )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_authidentity"
        unique_together = (("auth_provider", "ident"), ("auth_provider", "user"))

    __repr__ = sane_repr("user_id", "auth_provider_id")

    def __str__(self):
        return self.ident

    def get_audit_log_data(self):
        return {"user_id": self.user_id, "data": self.data}

    def get_display_name(self):
        return self.user.get_display_name()

    def get_label(self):
        return self.user.get_label()
