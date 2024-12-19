import os
import secrets
from typing import Any, ClassVar, Self
from urllib.parse import urlparse, urlunparse

import petname
import sentry_sdk
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
from sentry.db.models.fields.array import ArrayField
from sentry.db.models.manager.base import BaseManager
from sentry.hybridcloud.models.outbox import ControlOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.types.region import find_all_region_names


def generate_name():
    return petname.generate(2, " ", letters=10).title()


def generate_token():
    # `client_id` on `ApiApplication` is currently limited to 64 characters
    # so we need to restrict the length of the secret
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
    client_secret = models.TextField(default=generate_token)
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
    scopes = ArrayField(
        models.TextField(),
        null=True,
    )
    # ApiApplication by default provides user level access
    # This field is true if a certain application is limited to access only a specific org
    requires_org_level_access = models.BooleanField(default=False)

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=("client_id",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apiapplication"

    __repr__ = sane_repr("name", "owner_id")

    def __str__(self):
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

    def is_allowed_response_type(self, value):
        return value in ("code", "token")

    def normalize_url(self, value):
        parts = urlparse(value)
        normalized_path = os.path.normpath(parts.path)
        if normalized_path == ".":
            normalized_path = "/"
        elif value.endswith("/") and not normalized_path.endswith("/"):
            normalized_path += "/"
        return urlunparse(parts._replace(path=normalized_path))

    def is_valid_redirect_uri(self, value):
        value = self.normalize_url(value)

        for redirect_uri in self.redirect_uris.split("\n"):
            ruri = self.normalize_url(redirect_uri)
            if value == ruri:
                return True
            if value.startswith(ruri):
                with sentry_sdk.isolation_scope() as scope:
                    scope.set_context(
                        "api_application",
                        {
                            "client_id": self.client_id,
                            "redirect_uri": value,
                            "allowed_redirect_uris": self.redirect_uris,
                        },
                    )
                    message = "oauth.prefix-matched-redirect-uri"
                    sentry_sdk.capture_message(message, level="info")
                return True
        return False

    def get_default_redirect_uri(self):
        return self.redirect_uris.split()[0]

    def get_allowed_origins(self):
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
