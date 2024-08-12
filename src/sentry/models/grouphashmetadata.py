from typing import Any

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, JSONField, Model, region_silo_model


@region_silo_model
class GroupHashMetadata(Model):
    __relocation_scope__ = RelocationScope.Excluded

    class GroupingMethod(models.TextChoices):
        HASH = "hash"
        SEER = "seer"

    class HashBasis(models.TextChoices):
        MESSAGE = "msg"
        FULL_STACKTRACE = "stack"
        APP_STACKTRACE = "app_stack"
        FINGERPRINT = "fingerprint"
        # TODO: Are there others?

    # GENERAL
    grouphash = FlexibleForeignKey("sentry.GroupHash", unique=True, related_name="metadata")
    date_added = models.DateTimeField(default=timezone.now)
    grouping_method = models.PositiveIntegerField(choices=GroupingMethod)

    # HASHING
    # Most recent config to produce this hash
    # TODO: do we need first, also?
    # TODO: Is there a way to get choices for this from grouping.strategies.configurations.CONFIGURATIONS?
    grouping_config = models.CharField()
    # Eg. message, in-app stacktrace, full stacktrace, fingerprint, etc
    hash_basis = models.CharField(choices=HashBasis, null=True)
    # Eg. if message parameterized, what type of parameterization?, etc)
    hashing_metadata: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(
        null=True
    )
    # Built-in and custom stacktrace rules used
    enhancements: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)
    # Client fingerprint, value, matched rule, rule source
    fingerprint: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)
    # If this hash was associated to its group via a grouping config transition, what secondary hash
    # made the link?
    secondary_hash_match = FlexibleForeignKey(
        "sentry.GroupHash", null=True, related_name="secondary_matches"
    )

    # SEER
    seer_model = models.CharField(null=True)
    # This will be different than `date_added` if we send it to Seer as part of a backfill
    seer_date_sent = models.DateTimeField(null=True)
    # TODO Figure out how to best reuse the types in seer.similarity.types
    seer_results: models.Field[list[Any] | None, list[Any] | None] = JSONField(
        default=list, null=True
    )
    # Id of the event whose stacktrace was sent to Seer
    event_sent = models.CharField(max_length=32, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_grouphashmetadata"
