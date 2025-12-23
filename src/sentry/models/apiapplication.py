import logging
import os
import secrets
from enum import Enum
from typing import Any, ClassVar, Literal, Self, TypeIs
from urllib.parse import urlparse, urlunparse

import petname
from django.contrib.postgres.fields.array import ArrayField
from django.db import models, router, transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    control_silo_model,
    sane_repr,
)
from sentry.db.models.manager.base import BaseManager
from sentry.hybridcloud.models.outbox import ControlOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.types.region import find_all_region_names
from sentry.types.token import AuthTokenType

logger = logging.getLogger("sentry.oauth")


# Feature flags for ApiApplication behavior, version-gated.
class ApiApplicationFeature(str, Enum):
    STRICT_REDIRECT_URI = "strict-redirect-uri"


# Map feature → minimum version that enables it.
FEATURE_MIN_VERSION: dict[ApiApplicationFeature, int] = {
    ApiApplicationFeature.STRICT_REDIRECT_URI: 1,
}


def generate_name():
    return petname.generate(2, " ", letters=10).title()


def generate_token(token_type: AuthTokenType | str | None = None) -> str:
    # `client_id` on `ApiApplication` is currently limited to 64 characters
    # so we need to restrict the length of the secret
    if token_type:
        return f"{token_type}{secrets.token_hex(nbytes=32)}"
    return secrets.token_hex(nbytes=32)  # generates a 128-bit secure token


class ApiApplicationStatus:
    active = 0
    inactive = 1
    pending_deletion = 2
    deletion_in_progress = 3


@control_silo_model
class ApiApplication(Model):
    __relocation_scope__ = RelocationScope.Global

    client_id = models.CharField(max_length=64, unique=True, default=generate_token)
    client_secret = models.TextField(
        default=lambda: generate_token(token_type=AuthTokenType.USER_APP)
    )
    owner = FlexibleForeignKey("sentry.User", null=True)
    name = models.CharField(max_length=64, blank=True, default=generate_name)
    status = BoundedPositiveIntegerField(
        default=0,
        choices=(
            (ApiApplicationStatus.active, _("Active")),
            (ApiApplicationStatus.inactive, _("Inactive")),
        ),
        db_index=True,
    )
    allowed_origins = models.TextField(blank=True, null=True)
    redirect_uris = models.TextField()

    homepage_url = models.URLField(null=True)
    privacy_url = models.URLField(null=True)
    terms_url = models.URLField(null=True)

    date_added = models.DateTimeField(default=timezone.now)
    scopes = ArrayField(models.TextField(), default=list)
    # ApiApplication by default provides user level access
    # This field is true if a certain application is limited to access only a specific org
    requires_org_level_access = models.BooleanField(default=False, db_default=False)
    # Application version for feature-gating behavioral changes.
    # Existing apps are version 0 ("legacy"); new apps default to 0 until all
    # breaking changes are ready, then the default will be bumped to 1
    # ("oauth-21-draft").
    # TODO(dcramer): When all breaking features are shipped, bump both
    # default and db_default to 1 and add a migration to update the field
    # defaults accordingly.
    version = BoundedPositiveIntegerField(
        default=0,
        db_index=True,
        choices=(
            (0, _("legacy")),
            (1, _("oauth-21-draft")),
        ),
        db_default=0,
    )

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=("client_id",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apiapplication"

    __repr__ = sane_repr("name", "owner_id")

    def __str__(self) -> str:
        return self.name

    def delete(self, *args, **kwargs):
        with outbox_context(transaction.atomic(router.db_for_write(ApiApplication)), flush=False):
            for outbox in self.outboxes_for_update():
                outbox.save()
            return super().delete(*args, **kwargs)

    def outboxes_for_update(self) -> list[ControlOutbox]:
        return [
            ControlOutbox(
                shard_scope=OutboxScope.APP_SCOPE,
                shard_identifier=self.id,
                object_identifier=self.id,
                category=OutboxCategory.API_APPLICATION_UPDATE,
                region_name=region_name,
            )
            for region_name in find_all_region_names()
        ]

    @property
    def is_active(self):
        return self.status == ApiApplicationStatus.active

    def is_allowed_response_type(self, value: object) -> TypeIs[Literal["code", "token"]]:
        return value in ("code", "token")

    def has_feature(self, feature: ApiApplicationFeature) -> bool:
        min_version = FEATURE_MIN_VERSION.get(feature)
        if min_version is None:
            return False
        return self.version >= min_version

    def normalize_url(self, value):
        parts = urlparse(value)
        normalized_path = os.path.normpath(parts.path)
        if normalized_path == ".":
            normalized_path = "/"
        elif value.endswith("/") and not normalized_path.endswith("/"):
            normalized_path += "/"
        return urlunparse(parts._replace(path=normalized_path))

    def is_valid_redirect_uri(self, value):
        # Spec references:
        #   - Exact match to one of the registered redirect URIs (RFC 6749 §3.1.2.3):
        #     https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2.3
        #   - Native apps loopback exception (RFC 8252 §8.4):
        #     https://datatracker.ietf.org/doc/html/rfc8252#section-8.4
        value = self.normalize_url(value)

        # First: exact match only (spec-compliant), no logging.
        normalized_ruris = [
            self.normalize_url(redirect_uri) for redirect_uri in self.redirect_uris.split("\n")
        ]
        for ruri in normalized_ruris:
            if value == ruri:
                return True

        # RFC 8252 §8.4 / §7: For loopback interface redirects in native apps, accept
        # any ephemeral port when the registered URI omits a port. Match scheme, host,
        # path (and query) exactly, ignoring only the port.
        try:
            v_parts = urlparse(value)
        except Exception:
            v_parts = None
        if (
            v_parts
            and v_parts.scheme in {"http", "https"}
            and v_parts.hostname in {"127.0.0.1", "localhost", "::1"}
        ):
            for ruri in normalized_ruris:
                try:
                    r_parts = urlparse(ruri)
                except Exception:
                    continue
                if (
                    r_parts.scheme in {"http", "https"}
                    and r_parts.hostname in {"127.0.0.1", "localhost", "::1"}
                    and r_parts.port is None  # registered without a fixed port
                    and v_parts.scheme == r_parts.scheme
                    and v_parts.hostname == r_parts.hostname
                    and v_parts.path == r_parts.path
                    and v_parts.query == r_parts.query
                ):
                    return True

        # Then: prefix-only match (legacy behavior). Log on success.
        if not self.has_feature(ApiApplicationFeature.STRICT_REDIRECT_URI):
            for ruri in normalized_ruris:
                if value.startswith(ruri):
                    logger.warning(
                        "oauth.prefix_matched_redirect_uri",
                        extra={
                            "client_id": self.client_id,
                            "redirect_uri": value,
                            "matched_prefix": ruri,
                        },
                    )
                    return True
        return False

    def get_default_redirect_uri(self):
        return self.redirect_uris.split()[0]

    def get_allowed_origins(self) -> list[str]:
        if not self.allowed_origins:
            return []
        return [origin for origin in self.allowed_origins.split()]

    def get_redirect_uris(self):
        if not self.redirect_uris:
            return []
        return [redirect_uri for redirect_uri in self.redirect_uris.split()]

    def get_audit_log_data(self):
        return {
            "client_id": self.client_id,
            "name": self.name,
            "redirect_uris": self.redirect_uris,
            "allowed_origins": self.allowed_origins,
            "status": self.status,
            "version": self.version,
        }

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_string(json, SanitizableField(model_name, "allowed_origins"), lambda _: "")
        sanitizer.set_string(
            json, SanitizableField(model_name, "client_id"), lambda _: generate_token()
        )
        sanitizer.set_string(json, SanitizableField(model_name, "redirect_uris"), lambda _: "")
