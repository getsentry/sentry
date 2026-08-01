from __future__ import annotations

from uuid import uuid4

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel, Model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey

from .relocation import RegenerateInvestigationUUIDsOnRelocationMixin


class InvestigationReaction(models.TextChoices):
    THUMBS_UP = "thumbs-up", "Thumbs up"
    THUMBS_DOWN = "thumbs-down", "Thumbs down"
    LAUGH = "laugh", "Laugh"
    HOORAY = "hooray", "Hooray"
    CONFUSED = "confused", "Confused"
    HEART = "heart", "Heart"
    ROCKET = "rocket", "Rocket"
    EYES = "eyes", "Eyes"


@cell_silo_model
class InvestigationCellComment(RegenerateInvestigationUUIDsOnRelocationMixin, DefaultFieldsModel):
    """One entry in a cell's linear discussion."""

    __relocation_scope__ = RelocationScope.Organization

    uuid = models.UUIDField(default=uuid4, editable=False, unique=True)
    cell = FlexibleForeignKey(
        "investigations.InvestigationCell", on_delete=models.CASCADE, related_name="comments"
    )
    author_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    body = models.TextField()
    deleted_at = models.DateTimeField(null=True)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationcellcomment"
        indexes = [models.Index(fields=["cell", "date_added", "id"])]

    __repr__ = sane_repr("cell_id", "uuid", "author_id")


@cell_silo_model
class InvestigationCellReaction(Model):
    __relocation_scope__ = RelocationScope.Organization

    cell = FlexibleForeignKey(
        "investigations.InvestigationCell", on_delete=models.CASCADE, related_name="reactions"
    )
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    reaction = models.CharField(max_length=32, choices=InvestigationReaction.choices)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationcellreaction"
        constraints = [
            models.UniqueConstraint(
                fields=["cell", "user_id", "reaction"],
                name="investigation_unique_cell_reaction",
            )
        ]


@cell_silo_model
class InvestigationCommentReaction(Model):
    __relocation_scope__ = RelocationScope.Organization

    comment = FlexibleForeignKey(
        "investigations.InvestigationCellComment",
        on_delete=models.CASCADE,
        related_name="reactions",
    )
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    reaction = models.CharField(max_length=32, choices=InvestigationReaction.choices)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationcommentreaction"
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "user_id", "reaction"],
                name="investigation_unique_comment_reaction",
            )
        ]


@cell_silo_model
class InvestigationCommentUserMention(Model):
    __relocation_scope__ = RelocationScope.Organization

    comment = FlexibleForeignKey(
        "investigations.InvestigationCellComment",
        on_delete=models.CASCADE,
        related_name="user_mentions",
    )
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationcommentusermention"
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "user_id"],
                name="investigation_unique_comment_user_mention",
            )
        ]


@cell_silo_model
class InvestigationCommentTeamMention(Model):
    __relocation_scope__ = RelocationScope.Organization

    comment = FlexibleForeignKey(
        "investigations.InvestigationCellComment",
        on_delete=models.CASCADE,
        related_name="team_mentions",
    )
    team = FlexibleForeignKey("sentry.Team", on_delete=models.CASCADE)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationcommentteammention"
        constraints = [
            models.UniqueConstraint(
                fields=["comment", "team"],
                name="investigation_unique_comment_team_mention",
            )
        ]
