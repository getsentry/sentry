from __future__ import annotations

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@cell_silo_model
class NotebookSeen(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    notebook = FlexibleForeignKey(
        "notebooks.Notebook", on_delete=models.CASCADE, related_name="seen_by"
    )
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "notebooks"
        db_table = "notebooks_notebookseen"
        constraints = [
            models.UniqueConstraint(
                fields=["notebook", "user_id"], name="notebook_unique_seen_user"
            )
        ]

    __repr__ = sane_repr("notebook_id", "user_id", "last_seen")


@cell_silo_model
class NotebookComment(DefaultFieldsModel):
    """A comment on a notebook, or on one of its blocks when `block` is set."""

    __relocation_scope__ = RelocationScope.Excluded

    notebook = FlexibleForeignKey(
        "notebooks.Notebook", on_delete=models.CASCADE, related_name="comments"
    )
    block = FlexibleForeignKey(
        "notebooks.NotebookBlock", null=True, on_delete=models.CASCADE, related_name="comments"
    )
    author_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    body = models.TextField()

    class Meta:
        app_label = "notebooks"
        db_table = "notebooks_notebookcomment"

    __repr__ = sane_repr("notebook_id", "block_id", "author_id")
