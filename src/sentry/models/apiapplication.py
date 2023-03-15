from typing import List
from urllib.parse import urlparse
from uuid import uuid4

import petname
from django.db import models, transaction
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    control_silo_only_model,
    sane_repr,
)
from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.models.outbox import ControlOutbox, OutboxCategory, OutboxScope
from sentry.types.region import find_all_region_names


def generate_name():
    return petname.Generate(2, " ", letters=10).title()


def generate_token():
    return uuid4().hex + uuid4().hex


class ApiApplicationStatus:
    active = 0
    inactive = 1
    pending_deletion = 2
    deletion_in_progress = 3


@control_silo_only_model
class ApiApplication(Model):
    __include_in_export__ = True

    client_id = models.CharField(max_length=64, unique=True, default=generate_token)
    client_secret = models.TextField(default=generate_token)
    owner = FlexibleForeignKey("sentry.User")
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

    objects = BaseManager(cache_fields=("client_id",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apiapplication"

    __repr__ = sane_repr("name", "owner_id")

    def __str__(self):
        return self.name

    def delete(self, **kwargs):
        from sentry.models import NotificationSetting

        # There is no foreign key relationship so we have to manually cascade.
        NotificationSetting.objects.remove_for_project(self)
        with transaction.atomic(), in_test_psql_role_override("postgres"):
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
        return self.redirect_uris.split("\n", 1)[0]

    def get_allowed_origins(self):
        if not self.allowed_origins:
            return []
        return [a for a in self.allowed_origins.split("\n") if a]

    def get_audit_log_data(self):
        return {
            "client_id": self.client_id,
            "name": self.name,
            "redirect_uris": self.redirect_uris,
            "allowed_origins": self.allowed_origins,
            "status": self.status,
        }
