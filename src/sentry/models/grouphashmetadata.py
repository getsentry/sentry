from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, region_silo_model
from sentry.db.models.base import sane_repr
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.jsonfield import JSONField
from sentry.types.grouphash_metadata import HashingMetadata


# The overall grouping method used
class HashBasis(models.TextChoices):
    # Message logged by `capture_message`, or exception type and value (when there's no stack or
    # when all frames have been ruled out by stacktrace rules)
    MESSAGE = "message"
    # Either in-app or full stacktrace
    STACKTRACE = "stacktrace"
    # Custom fingerprint set by the client, by custom server-side rules, or by built-in server-side
    # rules. Does NOT include hybrid fingerprints, which are classified by their `{{ default }}`
    # half, i.e., the grouping method used before consideration of the custom value
    FINGERPRINT = "fingerprint"
    # Browser-reported security violation (CSP, expect-ct, expect-staple, HPKP), which is grouped
    # by the type of rule which was violated and the domain which violated it
    SECURITY_VIOLATION = "violation"
    # Error thrown when rendering templates
    #
    # TODO: This feature seems unique to the Django integration, the relay event schema contains a
    # note saying the `template` entry in events is deprecated, and the python SDK doesn't send
    # anything under that key - all of which suggests this may be vestigal. Once we have metrics on
    # how often we use each of these, it's possible this could go away.
    TEMPLATE = "template"
    # Legacy-legacy grouping method, wherein the client sets the hash directly, under the key `checksum`
    #
    # TODO: This, too, may or may not still be operative.
    CHECKSUM = "checksum"
    # A single bucket in each project where we throw events which can't be grouped any other way
    FALLBACK = "fallback"
    # Not a real variant category. If any records show up with this value, it means there's a bug in
    # our categorization logic.
    UNKNOWN = "unknown"


@region_silo_model
class GroupHashMetadata(Model):
    __relocation_scope__ = RelocationScope.Excluded

    # GENERAL

    grouphash = models.OneToOneField(
        "sentry.GroupHash", related_name="_metadata", on_delete=models.CASCADE
    )
    date_added = models.DateTimeField(default=timezone.now)
    # The platform of the event when generated the metadata. Likely different than the project
    # platform, as event platforms are normalized to a handful of known values, whereas project
    # platforms are all over the place.
    platform = models.CharField(null=True)

    # HASHING

    # Most recent config to produce this hash
    latest_grouping_config = models.CharField(null=True)
    # The primary grouping method (message, stacktrace, fingerprint, etc.)
    hash_basis: models.Field[HashBasis | None, HashBasis | None] = models.CharField(
        choices=HashBasis, null=True
    )
    # Metadata about the inputs to the hashing process and the hashing process itself (what
    # fingerprinting rules were matched? did we parameterize the message? etc.). For the specific
    # data stored, see the class definitions of the `HashingMetadata` subtypes.
    hashing_metadata: models.Field[HashingMetadata | None, HashingMetadata | None] = JSONField(
        null=True
    )

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
        "sentry.GroupHash", related_name="seer_matchees", on_delete=models.SET_NULL, null=True
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
