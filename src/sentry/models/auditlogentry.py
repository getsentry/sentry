from __future__ import annotations

import re
from typing import Any, Mapping

from django.db import models
from django.utils import timezone
from sentry_sdk import capture_exception

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    sane_repr,
)
from sentry.db.models.base import control_silo_only_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.services.hybrid_cloud.log import AuditLogEvent
from sentry.services.hybrid_cloud.user.service import user_service

MAX_ACTOR_LABEL_LENGTH = 64


def is_scim_token_actor(actor):
    scim_prefix = "scim-internal-integration-"
    return scim_prefix in actor.get_display_name()


def format_scim_token_actor_name(actor):
    scim_regex = re.compile(
        r".*([0-9a-fA-F]{6})\-[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{7}"
    )
    scim_match = re.match(scim_regex, actor.get_display_name())
    assert scim_match is not None
    uuid_prefix = scim_match[1]
    return f"SCIM Internal Integration ({uuid_prefix})"


@control_silo_only_model
class AuditLogEntry(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="CASCADE")
    actor_label = models.CharField(max_length=MAX_ACTOR_LABEL_LENGTH, null=True, blank=True)
    # if the entry was created via a user
    actor = FlexibleForeignKey(
        "sentry.User", related_name="audit_actors", null=True, blank=True, on_delete=models.SET_NULL
    )
    # if the entry was created via an api key
    actor_key = FlexibleForeignKey("sentry.ApiKey", null=True, blank=True)
    target_object = BoundedBigIntegerField(null=True)
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
    data: models.Field[Mapping[str, Any] | None, dict[str, Any]] = GzippedDictField()
    datetime = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_auditlogentry"
        indexes = [
            models.Index(fields=["organization_id", "datetime"]),
            models.Index(fields=["organization_id", "event", "datetime"]),
        ]

    __repr__ = sane_repr("organization_id", "type")

    def save(self, *args, **kwargs):
        # trim label to the max length
        self._apply_actor_label()
        self.actor_label = self.actor_label[:MAX_ACTOR_LABEL_LENGTH]
        super().save(*args, **kwargs)

    def _apply_actor_label(self):
        if not self.actor_label:
            assert self.actor_id or self.actor_key or self.ip_address
            if self.actor_id:
                # Fetch user by RPC service as
                # Audit logs are often created in regions.
                user = user_service.get_user(self.actor_id)
                self.actor_label = user.username
            elif self.actor_key:
                # TODO(hybridcloud) This requires an RPC service.
                self.actor_label = self.actor_key.key
            else:
                capture_exception(
                    Exception("Expected there to be a user or actor key for audit logging")
                )
                # Fallback to IP address if user or actor label not available
                self.actor_label = self.ip_address

    def as_event(self) -> AuditLogEvent:
        """
        Serializes a potential audit log database entry as a hybrid cloud event that should be deserialized and
        loaded via `from_event` as faithfully as possible.
        """
        if self.actor_label is not None:
            self.actor_label = self.actor_label[:MAX_ACTOR_LABEL_LENGTH]
        return AuditLogEvent(
            actor_label=self.actor_label,
            organization_id=int(
                self.organization_id
            ),  # prefer raising NoneType here over actually passing through
            date_added=self.datetime or timezone.now(),
            actor_user_id=self.actor_id and self.actor_id,
            target_object_id=self.target_object,
            ip_address=self.ip_address and str(self.ip_address),
            event_id=self.event and int(self.event),
            target_user_id=self.target_user_id,
            data=self.data,
            actor_key_id=self.actor_key_id,
        )

    @classmethod
    def from_event(cls, event: AuditLogEvent) -> AuditLogEntry:
        """
        Deserializes a kafka event object into a control silo database item.  Keep in mind that these event objects
        could have been created from previous code versions -- the events are stored on an async queue for indefinite
        delivery and from possibly older code versions.
        """
        from sentry.models.user import User

        if event.actor_label:
            label = event.actor_label[:MAX_ACTOR_LABEL_LENGTH]
        else:
            if event.actor_user_id:
                try:
                    label = User.objects.get(id=event.actor_user_id).username
                except User.DoesNotExist:
                    label = None
            else:
                label = None
        return AuditLogEntry(
            organization_id=event.organization_id,
            datetime=event.date_added,
            actor_id=event.actor_user_id,
            target_object=event.target_object_id,
            ip_address=event.ip_address,
            event=event.event_id,
            data=event.data,
            actor_label=label,
            target_user_id=event.target_user_id,
            actor_key_id=event.actor_key_id,
        )

    def get_actor_name(self):
        if self.actor:
            # fix display name if needed
            if is_scim_token_actor(self.actor):
                return format_scim_token_actor_name(self.actor)

            return self.actor.get_display_name()
        elif self.actor_key:
            return self.actor_key.key + " (api key)"
        return self.actor_label
