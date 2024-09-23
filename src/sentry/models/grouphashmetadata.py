from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, region_silo_model
from sentry.db.models.base import sane_repr
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


@region_silo_model
class GroupHashMetadata(Model):
    __relocation_scope__ = RelocationScope.Excluded

    # GENERAL

    grouphash = models.OneToOneField(
        "sentry.GroupHash", related_name="_metadata", on_delete=models.CASCADE
    )
    date_added = models.DateTimeField(default=timezone.now)

    # SEER

    # Only one hash representing each group is sent to Seer. For the grouphash actually sent, this
    # field and the `grouphash` field will be identical. For the grouphashes assigned to the same
    # group but which aren't sent, this will point to the GroupHash record for the sent hash. Note
    # that because of merging/unmerging, the sent GroupHash and this metadata's GroupHash (if not
    # one and the same) aren't guaranteed to forever point to the same group (though they will when
    # this field is written).
    seer_grouphash_sent = FlexibleForeignKey(
        "sentry.GroupHash",
        # If we end up needing to reference in this direction, we can handle it with a property on
        # GroupHash
        related_name="+",
        on_delete=models.DO_NOTHING,
        null=True,
    )

    # NOTE: The rest of the Seer-related fields are only stored on the metadata of the GroupHash
    # actually sent to Seer.

    # When this hash was sent to Seer. This will be different than `date_added` if we send it to
    # Seer as part of a backfill rather than during ingest.
    seer_date_sent = models.DateTimeField(null=True)
    # Id of the event whose stacktrace was sent to Seer
    seer_event_sent = models.CharField(max_length=32, null=True)
    # The version of the Seer model used to process this hash value
    seer_model = models.CharField(null=True)
    # The `GroupHash` record representing the match Seer sent back as a match (if any)
    seer_matched_grouphash = FlexibleForeignKey(
        "sentry.GroupHash", related_name="seer_matchees", on_delete=models.DO_NOTHING, null=True
    )
    # The similarity between this hash's stacktrace and the parent (matched) hash's stacktrace
    seer_match_distance = models.FloatField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_grouphashmetadata"

    @property
    def group_id(self) -> int | None:
        return self.grouphash.group_id

    @property
    def hash(self) -> str:
        return self.grouphash.hash

    __repr__ = sane_repr("grouphash_id", "group_id", "hash")
