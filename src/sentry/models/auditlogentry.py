import re

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    sane_repr,
)
from sentry.db.models.base import control_silo_only_model
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


@control_silo_only_model
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
        # trim label to the max length
        self._apply_actor_label()
        self.actor_label = self.actor_label[:MAX_ACTOR_LABEL_LENGTH]
        super().save(*args, **kwargs)

    def _apply_actor_label(self):
        if not self.actor_label:
            assert self.actor or self.actor_key
            if self.actor:
                self.actor_label = self.actor.username
            else:
                self.actor_label = self.actor_key.key

    def save_or_write_to_kafka(self):
        """
        Region Silos do not have access to the AuditLogEntry table which is specific to the control silo.
        For those silos, this method publishes the attempted audit log write to a durable kafka queue synchronously
        that will eventually be consumed by the control silo.  For the control silo, this method ultimately results
        in a save() call.
        """
        from sentry.region_to_control.producer import audit_log_entry_service

        audit_log_entry_service.produce_audit_log_entry(self)

    def as_kafka_event(self) -> AuditLogEvent:
        """
        Serializes a potential audit log database entry as a kafka event that should be deserialized and loaded via
        `from_event` as faithfully as possible.  It is worth keeping in mind that due to the over the wire, persistent
        queue involved in the final storage of these entries on the control silo from the region silo, that `from_event`
        may be called on this payload at a time in which the schema has changed in a future version.  Regressions are
        written and maintained to ensure the contract of this behavior.
        :return:
        """
        if self.actor_key:
            raise ValueError(
                "ApiKey is a control silo model!  This model should not be serialized for region to control consumption."
            )

        self._apply_actor_label()
        return AuditLogEvent(
            actor_label=self.actor_label,
            organization_id=int(
                self.organization.id
            ),  # prefer raising NoneType here over actually passing through
            time_of_creation=self.datetime or timezone.now(),
            actor_user_id=self.actor and self.actor.id,
            target_object_id=self.target_object,
            ip_address=self.ip_address and str(self.ip_address),
            event_id=self.event and int(self.event),
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
            datetime=event.time_of_creation,
            actor_id=event.actor_user_id,
            target_object=event.target_object_id,
            ip_address=event.ip_address,
            event=event.event_id,
            data=event.data,
            actor_label=event.actor_label,
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
