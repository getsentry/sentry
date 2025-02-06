from __future__ import annotations

from typing import TYPE_CHECKING

from django.db import models
from django.utils.translation import gettext_lazy as _

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_model,
)
from sentry.db.models.base import sane_repr
from sentry.types.grouphash_metadata import has_fingerprint_data
from sentry.utils import json
from sentry.utils.json import JSONDecodeError

if TYPE_CHECKING:
    from sentry.models.grouphashmetadata import GroupHashMetadata


@region_silo_model
class GroupHash(Model):
    __relocation_scope__ = RelocationScope.Excluded

    class State:
        UNLOCKED = None
        LOCKED_IN_MIGRATION = 1

    project = FlexibleForeignKey("sentry.Project", null=True)
    hash = models.CharField(max_length=32)
    group = FlexibleForeignKey("sentry.Group", null=True)

    # not-null => the event should be discarded
    group_tombstone_id = BoundedPositiveIntegerField(db_index=True, null=True)
    state = BoundedPositiveIntegerField(
        choices=[(State.LOCKED_IN_MIGRATION, _("Locked (Migration in Progress)"))], null=True
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_grouphash"
        unique_together = (("project", "hash"),)

    @property
    def metadata(self) -> GroupHashMetadata | None:
        try:
            return self._metadata
        except AttributeError:
            return None

    __repr__ = sane_repr("group_id", "hash")

    def get_associated_fingerprint(self) -> list[str] | None:
        """
        Pull a resolved fingerprint value from the grouphash's metadata, if possible.

        This only returns results for hashes which come from either hybrid or custom fingerprints.
        Even then, the hash may come from a time before we were storing such data, in which case
        this returns None.
        """
        if (
            not self.metadata
            or not self.metadata.hashing_metadata
            or not has_fingerprint_data(self.metadata.hashing_metadata)
        ):
            return None

        try:
            return json.loads(self.metadata.hashing_metadata["fingerprint"])

        # Fingerprints used to be stored by stringifying them rather than jsonifying them, and the
        # stringified ones can't be parsed and will cause this error
        except JSONDecodeError:
            return None
