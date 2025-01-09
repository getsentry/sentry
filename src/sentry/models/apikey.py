from __future__ import annotations

import secrets
from typing import TYPE_CHECKING, Any, ClassVar, Self, TypeGuard

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from sentry.auth.services.auth import AuthenticatedToken
from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedPositiveIntegerField, control_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.hybridcloud.outbox.base import ReplicatedControlModel
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.hybridcloud.services.replica import region_replica_service
from sentry.models.apiscopes import HasApiScopes

if TYPE_CHECKING:
    from sentry.hybridcloud.models.apikeyreplica import ApiKeyReplica


# TODO(dcramer): pull in enum library
class ApiKeyStatus:
    ACTIVE = 0
    INACTIVE = 1


@control_silo_model
class ApiKey(ReplicatedControlModel, HasApiScopes):
    __relocation_scope__ = RelocationScope.Global
    category = OutboxCategory.API_KEY_UPDATE
    replication_version = 3

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE")
    label = models.CharField(max_length=64, blank=True, default="Default")
    key = models.CharField(max_length=32, unique=True)
    status = BoundedPositiveIntegerField(
        default=0,
        choices=((ApiKeyStatus.ACTIVE, _("Active")), (ApiKeyStatus.INACTIVE, _("Inactive"))),
        db_index=True,
    )
    date_added = models.DateTimeField(default=timezone.now)
    allowed_origins = models.TextField(blank=True, null=True)

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=("key",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apikey"

    __repr__ = sane_repr("organization_id", "key")

    def handle_async_replication(self, region_name: str, shard_identifier: int) -> None:
        from sentry.auth.services.auth.serial import serialize_api_key

        region_replica_service.upsert_replicated_api_key(
            api_key=serialize_api_key(self), region_name=region_name
        )

    def __str__(self):
        return f"api_key_id={self.id}, status={self.status}"

    @classmethod
    def generate_api_key(cls):
        return secrets.token_hex(nbytes=16)

    @property
    def is_active(self):
        return self.status == ApiKeyStatus.ACTIVE

    def save(self, *args, **kwargs):
        if not self.key:
            self.key = ApiKey.generate_api_key()
        super().save(*args, **kwargs)

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

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_string(json, SanitizableField(model_name, "allowed_origins"), lambda _: "")
        sanitizer.set_string(json, SanitizableField(model_name, "key"))
        sanitizer.set_name(json, SanitizableField(model_name, "label"))


def is_api_key_auth(auth: object) -> TypeGuard[AuthenticatedToken | ApiKey | ApiKeyReplica]:
    """:returns True when an API Key is hitting the API."""
    from sentry.hybridcloud.models.apikeyreplica import ApiKeyReplica

    if isinstance(auth, AuthenticatedToken):
        return auth.kind == "api_key"
    return isinstance(auth, ApiKey) or isinstance(auth, ApiKeyReplica)
