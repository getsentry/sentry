import hmac
import itertools
import uuid
from hashlib import sha256
from typing import ClassVar, List

from django.db import models, router, transaction
from django.db.models import QuerySet
from django.utils import timezone
from rest_framework.request import Request

from sentry.backup.scopes import RelocationScope
from sentry.constants import (
    SENTRY_APP_SLUG_MAX_LENGTH,
    SentryAppInstallationStatus,
    SentryAppStatus,
)
from sentry.db.models import (
    ArrayField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    ParanoidManager,
    ParanoidModel,
    control_silo_only_model,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.fields.jsonfield import JSONField
from sentry.models.apiscopes import HasApiScopes
from sentry.models.outbox import ControlOutbox, OutboxCategory, OutboxScope, outbox_context
from sentry.types.region import find_all_region_names
from sentry.utils import metrics

# When a developer selects to receive "<Resource> Webhooks" it really means
# listening to a list of specific events. This is a mapping of what those
# specific events are for each resource.
EVENT_EXPANSION = {
    "issue": [
        "issue.created",
        "issue.resolved",
        "issue.ignored",
        "issue.assigned",
    ],
    "error": ["error.created"],
    "comment": ["comment.created", "comment.updated", "comment.deleted"],
}

# We present Webhook Subscriptions per-resource (Issue, Project, etc.), not
# per-event-type (issue.created, project.deleted, etc.). These are valid
# resources a Sentry App may subscribe to.
VALID_EVENT_RESOURCES = ("issue", "error", "comment")

REQUIRED_EVENT_PERMISSIONS = {
    "issue": "event:read",
    "error": "event:read",
    "project": "project:read",
    "member": "member:read",
    "organization": "org:read",
    "team": "team:read",
    "comment": "event:read",
}

# The only events valid for Sentry Apps are the ones listed in the values of
# EVENT_EXPANSION above. This list is likely a subset of all valid ServiceHook
# events.
VALID_EVENTS = tuple(itertools.chain(*EVENT_EXPANSION.values()))

MASKED_VALUE = "*" * 64

UUID_CHARS_IN_SLUG = 6


def default_uuid():
    return str(uuid.uuid4())


def track_response_code(status, integration_slug, webhook_event):
    metrics.incr(
        "integration-platform.http_response",
        sample_rate=1.0,
        tags={"status": status, "integration": integration_slug, "webhook_event": webhook_event},
    )


class SentryAppManager(ParanoidManager["SentryApp"]):
    def get_alertable_sentry_apps(self, organization_id: int) -> QuerySet:
        return self.filter(
            installations__organization_id=organization_id,
            is_alertable=True,
            installations__status=SentryAppInstallationStatus.INSTALLED,
            installations__date_deleted=None,
        ).distinct()

    def visible_for_user(self, request: Request) -> QuerySet:
        from sentry.auth.superuser import is_active_superuser

        if is_active_superuser(request):
            return self.all()

        return self.filter(status=SentryAppStatus.PUBLISHED)


@control_silo_only_model
class SentryApp(ParanoidModel, HasApiScopes, Model):
    __relocation_scope__ = RelocationScope.Global

    application = models.OneToOneField(
        "sentry.ApiApplication", null=True, on_delete=models.SET_NULL, related_name="sentry_app"
    )

    # Much of the OAuth system in place currently depends on a User existing.
    # This "proxy user" represents the SentryApp in those cases.
    proxy_user = models.OneToOneField(
        "sentry.User", null=True, on_delete=models.SET_NULL, related_name="sentry_app"
    )

    # The Organization the Sentry App was created in "owns" it. Members of that
    # Org have differing access, dependent on their role within the Org.
    owner_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE")

    name = models.TextField()
    slug = models.CharField(max_length=SENTRY_APP_SLUG_MAX_LENGTH, unique=True)
    author = models.TextField(null=True)
    status = BoundedPositiveIntegerField(
        default=SentryAppStatus.UNPUBLISHED, choices=SentryAppStatus.as_choices(), db_index=True
    )
    uuid = models.CharField(max_length=64, default=default_uuid)

    redirect_url = models.URLField(null=True)
    webhook_url = models.URLField(max_length=512, null=True)
    # does the application subscribe to `event.alert`,
    # meaning can it be used in alert rules as a {service} ?
    is_alertable = models.BooleanField(default=False)

    # does the application need to wait for verification
    # on behalf of the external service to know if its installations
    # are successfully installed ?
    verify_install = models.BooleanField(default=True)

    events = ArrayField(of=models.TextField, null=True)

    overview = models.TextField(null=True)
    schema = JSONField(default=dict)

    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(default=timezone.now)
    date_published = models.DateTimeField(null=True, blank=True)

    creator_user = FlexibleForeignKey(
        "sentry.User", null=True, on_delete=models.SET_NULL, db_constraint=False
    )
    creator_label = models.TextField(null=True)

    popularity = models.PositiveSmallIntegerField(null=True, default=1)
    metadata = JSONField(default=dict)

    objects: ClassVar[SentryAppManager] = SentryAppManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryapp"

    @property
    def is_published(self):
        return self.status == SentryAppStatus.PUBLISHED

    @property
    def is_unpublished(self):
        return self.status == SentryAppStatus.UNPUBLISHED

    @property
    def is_internal(self):
        return self.status == SentryAppStatus.INTERNAL

    @property
    def is_publish_request_inprogress(self):
        return self.status == SentryAppStatus.PUBLISH_REQUEST_INPROGRESS

    @property
    def slug_for_metrics(self):
        if self.is_internal:
            return "internal"
        if self.is_unpublished:
            return "unpublished"
        return self.slug

    def save(self, *args, **kwargs):
        self.date_updated = timezone.now()
        return super().save(*args, **kwargs)

    def is_installed_on(self, organization):
        from sentry.models.integrations.sentry_app_installation import SentryAppInstallation

        return SentryAppInstallation.objects.filter(
            organization_id=organization.id,
            sentry_app=self,
        ).exists()

    def build_signature(self, body):
        assert self.application is not None
        secret = self.application.client_secret
        return hmac.new(
            key=secret.encode("utf-8"), msg=body.encode("utf-8"), digestmod=sha256
        ).hexdigest()

    def show_auth_info(self, access):
        encoded_scopes = set({"%s" % scope for scope in list(access.scopes)})
        return set(self.scope_list).issubset(encoded_scopes)

    def outboxes_for_update(self) -> List[ControlOutbox]:
        return [
            ControlOutbox(
                shard_scope=OutboxScope.APP_SCOPE,
                shard_identifier=self.id,
                object_identifier=self.id,
                category=OutboxCategory.SENTRY_APP_UPDATE,
                region_name=region_name,
            )
            for region_name in find_all_region_names()
        ]

    def delete(self):
        from sentry.models.avatars.sentry_app_avatar import SentryAppAvatar

        with outbox_context(transaction.atomic(using=router.db_for_write(SentryApp))):
            for outbox in self.outboxes_for_update():
                outbox.save()

        SentryAppAvatar.objects.filter(sentry_app=self).delete()
        return super().delete()

    def _disable(self):
        self.events = []
        self.save(update_fields=["events"])
