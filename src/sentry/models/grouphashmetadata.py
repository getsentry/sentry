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
