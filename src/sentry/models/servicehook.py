import hmac
from hashlib import sha256
from uuid import uuid4

from django.db import models
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.db.models import (
    ArrayField,
    BaseManager,
    BoundedPositiveIntegerField,
    EncryptedTextField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)
from sentry.models import SentryApp

SERVICE_HOOK_EVENTS = [
    "event.alert",
    "event.created",
    # 'issue.created', This is only allowed for Sentry Apps, but listing it
    #                  here for discoverability purposes.
]


class ServiceHookProject(Model):
    __include_in_export__ = False

    service_hook = FlexibleForeignKey("sentry.ServiceHook")
    project_id = BoundedPositiveIntegerField(db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_servicehookproject"
        unique_together = (("service_hook", "project_id"),)


def generate_secret():
    return uuid4().hex + uuid4().hex


class ServiceHook(Model):
    __include_in_export__ = True

    guid = models.CharField(max_length=32, unique=True, null=True)
    # hooks may be bound to an api application, or simply registered by a user
    application = FlexibleForeignKey("sentry.ApiApplication", null=True)
    actor_id = BoundedPositiveIntegerField(db_index=True)
    project_id = BoundedPositiveIntegerField(db_index=True, null=True)
    organization_id = BoundedPositiveIntegerField(db_index=True, null=True)
    url = models.URLField(max_length=512)
    secret = EncryptedTextField(default=generate_secret)
    events = ArrayField(of=models.TextField)
    status = BoundedPositiveIntegerField(
        default=0, choices=ObjectStatus.as_choices(), db_index=True
    )
    version = BoundedPositiveIntegerField(default=0, choices=((0, "0"),))
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager(cache_fields=("guid",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_servicehook"

    __repr__ = sane_repr("guid", "project_id")

    @property
    def created_by_sentry_app(self):
        return self.application_id and self.sentry_app

    @property
    def sentry_app(self):
        try:
            return SentryApp.objects.get(application_id=self.application_id)
        except SentryApp.DoesNotExist:
            return

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

    def add_project(self, project):
        """
        Add a project to the service hook.

        """
        ServiceHookProject.objects.create(project_id=project.id, service_hook_id=self.id)
