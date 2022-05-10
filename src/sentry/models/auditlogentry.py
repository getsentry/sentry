from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    sane_repr,
)

MAX_ACTOR_LABEL_LENGTH = 64


class AuditLogEntry(Model):
    __include_in_export__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    actor_label = models.CharField(max_length=MAX_ACTOR_LABEL_LENGTH, null=True, blank=True)
    # if the entry was created via a user
    actor = FlexibleForeignKey(
        "sentry.User", related_name="audit_actors", null=True, blank=True, on_delete=models.SET_NULL
    )
    # if the entry was created via an api key
    actor_key = FlexibleForeignKey("sentry.ApiKey", null=True, blank=True)
    target_object = BoundedPositiveIntegerField(null=True)
    target_user = FlexibleForeignKey(
        "sentry.User",
        null=True,
        blank=True,
        related_name="audit_targets",
        on_delete=models.SET_NULL,
    )
    # TODO(dcramer): we want to compile this mapping into JSX for the UI
    event = BoundedPositiveIntegerField()
    ip_address = models.GenericIPAddressField(null=True, unpack_ipv4=True)
    data = GzippedDictField()
    datetime = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_auditlogentry"
        indexes = [
            models.Index(fields=["organization", "datetime"]),
            models.Index(fields=["organization", "event", "datetime"]),
        ]

    __repr__ = sane_repr("organization_id", "type")

    def save(self, *args, **kwargs):
        if not self.actor_label:
            assert self.actor or self.actor_key
            if self.actor:
                self.actor_label = self.actor.username
            else:
                self.actor_label = self.actor_key.key
        # trim label to the max length
        self.actor_label = self.actor_label[:MAX_ACTOR_LABEL_LENGTH]
        super().save(*args, **kwargs)

    def get_actor_name(self):
        if self.actor:
            return self.actor.get_display_name()
        elif self.actor_key:
            return self.actor_key.key + " (api key)"
        return self.actor_label
