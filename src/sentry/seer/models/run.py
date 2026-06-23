from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any
from uuid import uuid4

from django.db import models

from sentry import options
from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import BoundedBigIntegerField, FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository

logger = logging.getLogger(__name__)


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
class SeerRunPullRequest(DefaultFieldsModel):
    """Links a Seer run to a pull request it opened."""

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
                fields=["seer_run", "pull_request"],
                name="seer_runpr_unique_run_pr",
            ),
        ]
        indexes = [
            models.Index(fields=["pull_request"]),
        ]

    __repr__ = sane_repr("seer_run_id", "pull_request_id")

    @classmethod
    def maybe_link_run_to_pull_requests(
        cls,
        *,
        organization: Organization,
        pull_requests: Sequence[Mapping[str, Any]],
        run_id: int,
    ) -> None:
        """Best-effort, killswitch-gated: link each PR a Seer run opened.

        ``pull_requests`` is the ``seer.pr_created`` payload; ``run_id`` is the
        run's ``seer_run_state_id``. Never raises — runs inline on the webhook path.
        """
        if options.get("seer.run-pr-link.killswitch.enabled"):
            return
        try:
            cls._record_run_links(
                organization=organization, pull_requests=pull_requests, run_id=run_id
            )
        except Exception:
            logger.exception(
                "seer.pr_link.failed",
                extra={"organization_id": organization.id, "seer_run_state_id": run_id},
            )

    @classmethod
    def _record_run_links(
        cls,
        *,
        organization: Organization,
        pull_requests: Sequence[Mapping[str, Any]],
        run_id: int,
    ) -> None:
        run = SeerRun.objects.filter(
            organization_id=organization.id, seer_run_state_id=run_id
        ).first()
        if run is None:
            logger.warning(
                "seer.pr_link.run_not_found",
                extra={"organization_id": organization.id, "seer_run_state_id": run_id},
            )
            return

        for entry in pull_requests:
            repo_name = entry.get("repo_name")
            pr_number = (entry.get("pull_request") or {}).get("pr_number")
            log_context = {
                "organization_id": organization.id,
                "seer_run_state_id": run_id,
                "repo_name": repo_name,
                "pr_number": pr_number,
            }
            if not repo_name or pr_number is None:
                logger.warning("seer.pr_link.missing_fields", extra=log_context)
                continue

            try:
                repos = list(
                    Repository.objects.filter(
                        organization_id=organization.id,
                        name=repo_name,
                        status=ObjectStatus.ACTIVE,
                    ).order_by("id")[:2]
                )
                if len(repos) != 1:
                    logger.warning(
                        "seer.pr_link.repo_unresolved",
                        extra={**log_context, "repo_matches": len(repos)},
                    )
                    continue

                pull_request, _ = PullRequest.objects.get_or_create(
                    organization_id=organization.id,
                    repository_id=repos[0].id,
                    key=str(pr_number),
                )
                cls.objects.get_or_create(seer_run=run, pull_request=pull_request)
            except Exception:
                # Isolate per entry so one bad repo doesn't drop the rest.
                logger.exception("seer.pr_link.failed", extra=log_context)
                continue

            logger.info(
                "seer.pr_link.recorded",
                extra={**log_context, "pull_request_id": pull_request.id},
            )


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
