import secrets
from typing import ClassVar, List
from urllib.parse import urlparse

import petname
from django.db import models, router, transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from typing_extensions import Self

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    control_silo_only_model,
    sane_repr,
)
from sentry.models.outbox import ControlOutbox, OutboxCategory, OutboxScope, outbox_context
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


@control_silo_only_model
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

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=("client_id",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apiapplication"

    __repr__ = sane_repr("name", "owner_id")

    def __str__(self):
        return self.name

    def delete(self, **kwargs):
        with outbox_context(transaction.atomic(router.db_for_write(ApiApplication)), flush=False):
            for outbox in self.outboxes_for_update():
                outbox.save()
            return super().delete(**kwargs)

    def outboxes_for_update(self) -> List[ControlOutbox]:
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

    def is_valid_redirect_uri(self, value):
        v_netloc = urlparse(value).netloc
        for ruri in self.redirect_uris.split("\n"):
            if v_netloc != urlparse(ruri).netloc:
                continue
            if value.startswith(ruri):
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
