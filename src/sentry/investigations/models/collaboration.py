from __future__ import annotations

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


@cell_silo_model
class InvestigationSeen(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    investigation = FlexibleForeignKey(
        "investigations.Investigation", on_delete=models.CASCADE, related_name="seen_by"
    )
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationseen"
        constraints = [
            models.UniqueConstraint(
                fields=["investigation", "user_id"],
                name="investigation_unique_seen_user",
            )
        ]

    __repr__ = sane_repr("investigation_id", "user_id", "last_seen")


@cell_silo_model
class InvestigationComment(DefaultFieldsModel):
    """A comment on an investigation, or on one of its blocks when `block` is set."""

    __relocation_scope__ = RelocationScope.Excluded

    investigation = FlexibleForeignKey(
        "investigations.Investigation", on_delete=models.CASCADE, related_name="comments"
    )
    block = FlexibleForeignKey(
        "investigations.InvestigationBlock",
        null=True,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    body = models.TextField()

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationcomment"

    __repr__ = sane_repr("investigation_id", "block_id", "author_id")
