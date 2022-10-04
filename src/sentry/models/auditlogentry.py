import re

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    control_silo_model,
    sane_repr,
)
from sentry.region_to_control.messages import AuditLogEvent

MAX_ACTOR_LABEL_LENGTH = 64


def is_scim_token_actor(actor):
    scim_prefix = "scim-internal-integration-"
    return scim_prefix in actor.get_display_name()


def format_scim_token_actor_name(actor):
    scim_regex = re.compile(
        r".*([0-9a-fA-F]{6})\-[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{7}"
    )
    scim_match = re.match(scim_regex, actor.get_display_name())
    uuid_prefix = scim_match.groups()[0]
    return "SCIM Internal Integration (" + uuid_prefix + ")"


@control_silo_model
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

    def save_or_write_to_kafka(self):
        pass

    def as_kafka_event(self):
        """
        Serializes a potential audit log database entry as a kafka event that should be deserialized and loaded via
        `from_event` as faithfully as possible.  It is worth keeping in mind that due to the over the wire, persistent
        queue involved in the final storage of these entries on the control silo from the region silo, that `from_event`
        may be called on this payload at a time in which the schema has changed in a future version.  Regressions are
        written and maintained to ensure the contract of this behavior.
        :return:
        """
        return AuditLogEvent(
            organization_id=int(
                self.organization.id
            ),  # prefer raising NoneType here over actually passing through
            datetime=self.datetime or timezone.now(),
            actor_user_id=self.actor and self.actor.id,
            target_object_id=self.target_object and self.target_object.id,
            ip_address=str(self.ip_address),
            event_id=int(self.event),
            data=self.data,
        )

    @classmethod
    def from_event(cls, event: AuditLogEvent) -> "AuditLogEntry":
        """
        Deserializes a kafka event object into a control silo database item.  Keep in mind that these event objects
        could have been created from previous code versions -- the kafka queue introduces persistent asynchronous
        contact between the serialization and deserialization processes that could imply all sorts of previous
        application states.  This method handles gracefully the process of converting the event object into a database
        object for storage.
        """
        return AuditLogEntry(
            organization_id=event.organization_id,
            datetime=event.datetime,
            actor_id=event.actor_user_id,
            target_object_id=event.target_object_id,
            ip_address=event.ip_address,
            event=event.event_id,
            data=event.data,
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
