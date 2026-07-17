from __future__ import annotations

from typing import TypedDict
from uuid import uuid4

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.pullrequest import PullRequest
from sentry.seer.autofix.constants import CodingAgentStatus


class SeerRunType(models.TextChoices):
    EXPLORER = "explorer"
    PR_REVIEW = "pr_review"
    ASSISTED_QUERY = "assisted_query"
    FEATURE_RUN = "feature_run"


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

    # What specifically triggered this run, e.g. an AutofixReferrer value.
    referrer = models.CharField(max_length=256, null=True)

    last_triggered_at = models.DateTimeField()
    extras = models.JSONField(db_default={}, default=dict)

    @property
    def pull_requests(self) -> models.QuerySet[PullRequest]:
        """The pull requests this run opened, via the SeerRunPullRequest links."""
        return PullRequest.objects.filter(seer_run_links__seer_run=self)

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
            # Per-org referrer breakdowns (e.g. "all night-shift-triggered runs").
            models.Index(fields=["organization", "referrer", "-last_triggered_at"]),
            # TTL/cleanup scans across all orgs.
            models.Index(fields=["last_triggered_at"]),
        ]

    __repr__ = sane_repr("organization_id", "seer_run_state_id", "type", "referrer")


@cell_silo_model
class SeerRunPullRequest(DefaultFieldsModel):
    """Links a Seer run to a pull request it opened.

    A run opens many PRs, but a PR is opened by exactly one run, so
    ``pull_request`` is unique (one row per PR).
    """

    __relocation_scope__ = RelocationScope.Excluded

    seer_run = FlexibleForeignKey(
        "seer.SeerRun", on_delete=models.CASCADE, related_name="pull_request_links"
    )
    pull_request = FlexibleForeignKey(
        "sentry.PullRequest", on_delete=models.CASCADE, related_name="seer_run_links"
    )

    class Meta:
        app_label = "seer"
        db_table = "seer_seerrunpullrequest"
        constraints = [
            models.UniqueConstraint(
                fields=["pull_request"],
                name="seer_runpr_unique_pr",
            ),
        ]

    __repr__ = sane_repr("seer_run_id", "pull_request_id")


class SeerRunCodingAgentHandoffExtras(TypedDict, total=False):
    # Deep link to the agent's session on the provider's own site (e.g. Cursor).
    # Not every provider supplies one.
    agent_url: str | None


@cell_silo_model
class SeerRunCodingAgentHandoff(DefaultFieldsModel):
    """Records a coding agent Seer handed a run off to (Cursor/GitHub Copilot/Claude
    Code), and its outcome.

    A run can hand off to multiple agents (one per repo), so ``seer_run`` is not unique.
    """

    __relocation_scope__ = RelocationScope.Excluded

    seer_run = FlexibleForeignKey(
        "seer.SeerRun", on_delete=models.CASCADE, related_name="coding_agent_handoffs"
    )
    provider = models.CharField(max_length=256)
    agent_id = models.CharField(max_length=256, unique=True)
    status = models.CharField(
        max_length=256,
        choices=[(s.value, s.value) for s in CodingAgentStatus],
        default=CodingAgentStatus.PENDING,
        db_default=CodingAgentStatus.PENDING,
    )
    # See SeerRunCodingAgentHandoffExtras for the expected shape.
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_seerruncodingagenthandoff"
        indexes = [models.Index(fields=["seer_run", "status"])]

    __repr__ = sane_repr("seer_run_id", "provider", "status")


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
