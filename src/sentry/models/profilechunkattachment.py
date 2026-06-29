from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.db import models
from django.db.models.expressions import DatabaseDefault
from django.db.models.functions import Now
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, cell_silo_model, sane_repr
from sentry.objectstore import default_attachment_retention


@cell_silo_model
class ProfileChunkAttachment(Model):
    """
    Metadata for an attachment associated with a continuous-profiling chunk
    (e.g. a Perfetto system trace).

    Relay stores the attachment blob directly in Objectstore and forwards the
    resulting key (``stored_id``) on the profile-chunk Kafka message. We only
    persist the reference here -- the blob itself is owned by Objectstore and
    reclaimed via its TTL. ``date_expires`` mirrors that TTL so the row is
    pruned on the same schedule (registered in
    ``models_which_use_expiry_deletions``), and reads tolerate a blob that has
    already expired.
    """

    __relocation_scope__ = RelocationScope.Excluded

    # the things we look attachments up by:
    project_id = BoundedBigIntegerField()
    profiler_id = models.CharField(max_length=36)
    chunk_id = models.CharField(max_length=36)

    name = models.TextField()
    content_type = models.TextField(null=True)

    # The Objectstore key the blob was stored under by Relay (under the
    # "profile_attachments" usecase). Read back via
    # ``get_profile_attachments_session(org, project).get(stored_id)``.
    stored_id = models.TextField()

    date_added = models.DateTimeField(default=timezone.now)
    date_expires = models.DateTimeField(
        db_default=Now() + timedelta(days=30),
        db_index=True,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_profilechunkattachment"
        constraints = (
            # Dedupes attachments when a profile-chunk message is reprocessed. The
            # (project_id, profiler_id, chunk_id) prefix also serves the lookup
            # queries, so no separate index is needed.
            models.UniqueConstraint(
                fields=("project_id", "profiler_id", "chunk_id", "stored_id"),
                name="sentry_profilechunkattach_unique",
            ),
        )

    __repr__ = sane_repr("profiler_id", "chunk_id", "name")

    def save(self, *args: Any, **kwargs: Any) -> None:
        # Computed here rather than as a field default to avoid freezing a callable
        # reference into migrations, which would break if the function is ever renamed.
        if self.date_expires is None or isinstance(self.date_expires, DatabaseDefault):  # type: ignore[unreachable]
            self.date_expires = timezone.now() + timedelta(days=default_attachment_retention())  # type: ignore[unreachable]
        super().save(*args, **kwargs)
