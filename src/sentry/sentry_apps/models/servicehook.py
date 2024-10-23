import hmac
import secrets
from functools import cached_property
from hashlib import sha256
from typing import Any, ClassVar, Self
from uuid import uuid4

from django.db import models
from django.utils import timezone

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import (
    ArrayField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app.model import RpcSentryApp

SERVICE_HOOK_EVENTS = [
    "event.alert",
    "event.created",
    # 'issue.created', This is only allowed for Sentry Apps, but listing it
    #                  here for discoverability purposes.
]


@region_silo_model
class ServiceHookProject(Model):
    __relocation_scope__ = RelocationScope.Excluded

    service_hook = FlexibleForeignKey("sentry.ServiceHook")
    project_id = BoundedBigIntegerField(db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_servicehookproject"
        unique_together = (("service_hook", "project_id"),)


def generate_secret():
    # the `secret` field on `ServiceHook` does not have a max_length so we can use the default length
    # of 64 characters. This is sufficiently secure and will update over time to sane defaults.
    return secrets.token_hex()


@region_silo_model
class ServiceHook(Model):
    __relocation_scope__ = RelocationScope.Global

    guid = models.CharField(max_length=32, unique=True, null=True)
    # hooks may be bound to an api application, or simply registered by a user
    application_id = HybridCloudForeignKey("sentry.ApiApplication", null=True, on_delete="CASCADE")
    actor_id = BoundedBigIntegerField(db_index=True)
    installation_id = HybridCloudForeignKey(
        "sentry.SentryAppInstallation", null=True, on_delete="CASCADE"
    )
    project_id = BoundedBigIntegerField(db_index=True, null=True)
    organization_id = BoundedBigIntegerField(db_index=True, null=True)
    url = models.URLField(max_length=512)
    secret = models.TextField(default=generate_secret)
    events = ArrayField(of=models.TextField)
    status = BoundedPositiveIntegerField(
        default=0, choices=ObjectStatus.as_choices(), db_index=True
    )
    version = BoundedPositiveIntegerField(default=0, choices=((0, "0"),))
    date_added = models.DateTimeField(default=timezone.now)

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=("guid",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_servicehook"

    __repr__ = sane_repr("guid", "project_id")

    @property
    def created_by_sentry_app(self):
        return self.application_id and bool(self.sentry_app)

    @cached_property
    def sentry_app(self) -> RpcSentryApp | None:
        if self.application_id is None:
            return None
        else:
            return app_service.get_by_application_id(application_id=self.application_id)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.guid is None:
            self.guid = uuid4().hex

    def __str__(self):
        return str(self.guid)

    def build_signature(self, body):
        return hmac.new(
            key=self.secret.encode("utf-8"), msg=body.encode("utf-8"), digestmod=sha256
        ).hexdigest()

    def get_audit_log_data(self):
        return {"url": self.url}

    def add_project(self, project_or_project_id):
        """
        Add a project to the service hook.
        """
        from sentry.models.project import Project

        ServiceHookProject.objects.create(
            project_id=(
                project_or_project_id.id
                if isinstance(project_or_project_id, Project)
                else project_or_project_id
            ),
            service_hook_id=self.id,
        )

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_uuid(json, SanitizableField(model_name, "guid"))
        json["fields"]["events"] = "[]"
