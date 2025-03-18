from __future__ import annotations

from collections.abc import Collection
from typing import Any

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, control_silo_model, sane_repr
from sentry.db.models.fields.jsonfield import JSONField
from sentry.hybridcloud.outbox.base import ReplicatedControlModel
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.types.region import find_regions_for_orgs


@control_silo_model
class AuthIdentity(ReplicatedControlModel):
    __relocation_scope__ = RelocationScope.Global
    category = OutboxCategory.AUTH_IDENTITY_UPDATE
    replication_version = 2

    # NOTE: not a fk to sentry user
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    auth_provider = FlexibleForeignKey("sentry.AuthProvider")
    ident = models.CharField(max_length=128)
    data: models.Field[dict[str, Any], dict[str, Any]] = JSONField()
    last_verified = models.DateTimeField(default=timezone.now)
    last_synced = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    def outbox_region_names(self) -> Collection[str]:
        return find_regions_for_orgs([self.auth_provider.organization_id])

    def handle_async_replication(self, region_name: str, shard_identifier: int) -> None:
        from sentry.auth.services.auth.serial import serialize_auth_identity
        from sentry.hybridcloud.services.replica.service import region_replica_service

        serialized = serialize_auth_identity(self)
        region_replica_service.upsert_replicated_auth_identity(
            auth_identity=serialized, region_name=region_name
        )

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_json(json, SanitizableField(model_name, "data"), {})
        sanitizer.set_string(json, SanitizableField(model_name, "ident"))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_authidentity"
        unique_together = (("auth_provider", "ident"), ("auth_provider", "user"))
        indexes = [
            models.Index(fields=["last_synced"], name="auth_identity_last_synced_idx"),
        ]

    __repr__ = sane_repr("user_id", "auth_provider_id")

    def __str__(self):
        return self.ident

    def get_audit_log_data(self):
        return {"user_id": self.user_id, "data": self.data}

    def get_display_name(self):
        return self.user.get_display_name()

    def get_label(self):
        return self.user.get_label()
