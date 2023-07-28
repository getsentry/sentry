import secrets
from typing import TypedDict

from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from bitfield import typed_dict_bitfield
from sentry.db.models import (
    ArrayField,
    BaseManager,
    BoundedPositiveIntegerField,
    Model,
    control_silo_only_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


# TODO(dcramer): pull in enum library
class ApiKeyStatus:
    ACTIVE = 0
    INACTIVE = 1


@control_silo_only_model
class ApiKey(Model):
    __include_in_export__ = True

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="cascade")
    label = models.CharField(max_length=64, blank=True, default="Default")
    key = models.CharField(max_length=32, unique=True)
    scopes = typed_dict_bitfield(
        TypedDict(  # type: ignore[operator]
            "scopes",
            {
                "project:read": bool,
                "project:write": bool,
                "project:admin": bool,
                "project:releases": bool,
                "team:read": bool,
                "team:write": bool,
                "team:admin": bool,
                "event:read": bool,
                "event:write": bool,
                "event:admin": bool,
                "org:read": bool,
                "org:write": bool,
                "org:admin": bool,
                "member:read": bool,
                "member:write": bool,
                "member:admin": bool,
            },
        )
    )
    scope_list = ArrayField(of=models.TextField)
    status = BoundedPositiveIntegerField(
        default=0,
        choices=((ApiKeyStatus.ACTIVE, _("Active")), (ApiKeyStatus.INACTIVE, _("Inactive"))),
        db_index=True,
    )
    date_added = models.DateTimeField(default=timezone.now)
    allowed_origins = models.TextField(blank=True, null=True)

    objects = BaseManager(cache_fields=("key",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apikey"

    __repr__ = sane_repr("organization_id", "key")

    def __str__(self):
        return str(self.key)

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

    def get_scopes(self):
        if self.scope_list:
            return self.scope_list
        return [k for k, v in self.scopes.items() if v]

    def has_scope(self, scope):
        return scope in self.get_scopes()


def is_api_key_auth(auth: object) -> bool:
    """:returns True when an API Key is hitting the API."""
    from sentry.services.hybrid_cloud.auth import AuthenticatedToken

    if isinstance(auth, AuthenticatedToken):
        return auth.kind == "api_key"
    return isinstance(auth, ApiKey)
