from datetime import timedelta
from typing import Collection

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, control_silo_only_model, sane_repr
from sentry.db.models.fields.jsonfield import JSONField
from sentry.db.models.outboxes import ReplicatedControlModel
from sentry.models import OutboxCategory
from sentry.types.region import find_regions_for_orgs


@control_silo_only_model
class AuthIdentity(ReplicatedControlModel):
    __relocation_scope__ = RelocationScope.Global
    category = OutboxCategory.AUTH_IDENTITY_UPDATE

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
        from sentry.services.hybrid_cloud.organization.service import organization_service

        serialized = serialize_auth_identity(self)
        organization_service.upsert_replicated_auth_identity(
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
