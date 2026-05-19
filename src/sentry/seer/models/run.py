from __future__ import annotations

from uuid import uuid4

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class SeerRunType(models.TextChoices):
    EXPLORER = "explorer"
    AUTOFIX = "autofix"
    PR_REVIEW = "pr_review"
    ASSISTED_QUERY = "assisted_query"


class SeerRunMirrorStatus(models.TextChoices):
    PENDING = "pending"
    LIVE = "live"
    FAILED = "failed"


@cell_silo_model
class SeerRun(DefaultFieldsModel):
    """
    Sentry-side mirror of Seer's DbRunState. One row per run regardless of
    type. Conversation content (DbRunState.value JSON) intentionally stays in
    Seer and is not mirrored here.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)

    # Null for system runs (e.g. Night Shift) and for runs whose triggering
    # user has since been deleted.
    user_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")

    # External id so we don't leak seer run count.
    uuid = models.UUIDField(default=uuid4, unique=True, editable=False)

    # FK value from Seer's DbRunState.id.
    # Nullable to support outbox writing
    seer_run_state_id = BoundedBigIntegerField(null=True, unique=True)

    type = models.CharField(max_length=256, choices=SeerRunType.choices)
    mirror_status = models.CharField(
        max_length=256,
        choices=SeerRunMirrorStatus.choices,
        default=SeerRunMirrorStatus.PENDING,
        db_default=SeerRunMirrorStatus.PENDING,
    )

    last_triggered_at = models.DateTimeField()
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_seerrun"
        indexes = [
            # Per-org recency queries (listing, activity feeds).
            models.Index(fields=["organization", "-last_triggered_at"]),
            # Per-user session history.
            models.Index(fields=["organization", "user_id", "-last_triggered_at"]),
            # Per-org type breakdowns (e.g. "all PR reviews for this org").
            models.Index(fields=["organization", "type", "-last_triggered_at"]),
            # TTL/cleanup scans across all orgs.
            models.Index(fields=["last_triggered_at"]),
        ]

    __repr__ = sane_repr("organization_id", "seer_run_state_id", "type")


@cell_silo_model
class SeerAgentRun(DefaultFieldsModel):
    """
    Sibling of SeerRun for runs that appear in the agent session-history UI.
    Mirrors Seer's DbExplorerRun table.
    """

    __relocation_scope__ = RelocationScope.Excluded

    run = models.OneToOneField("seer.SeerRun", on_delete=models.CASCADE, related_name="agent")
    title = models.CharField(max_length=256)
    # DO_NOTHING so we keep the historical run record AND preserve semantics:
    # NULL means the run was never tied to a project/group (e.g. assisted query),
    # while a stale non-NULL id means it ran against a project/group that has
    # since been deleted. Readers must tolerate dereferencing a stale id.
    project = FlexibleForeignKey(
        "sentry.Project", on_delete=models.DO_NOTHING, db_constraint=False, null=True
    )
    group = FlexibleForeignKey(
        "sentry.Group", on_delete=models.DO_NOTHING, db_constraint=False, null=True
    )
    # What feature/surface invoked this run: "autofix", "night_shift",
    # "slack_thread", "dashboard_generate", "bug-fixer", "chat", etc.
    source = models.CharField(max_length=256)
    # Source-specific payload. Keys are owned per source, e.g.:
    #   source="slack_thread" -> {"thread_ts": "..."}
    #   source="dashboard_generate" -> {"dashboard_id": "..."}
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_seeragentrun"

    __repr__ = sane_repr("run_id", "source", "group_id")
