from __future__ import annotations

import logging
from typing import Any

from django.db import router, transaction
from taskbroker_client.retry import Retry

from sentry import features
from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.integration_utils import get_commit_context_client
from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.snapshots.utils import build_changes_map
from sentry.preprod.vcs.pr_comments.snapshot_templates import format_snapshot_pr_comment
from sentry.preprod.vcs.pr_comments.tasks import find_existing_comment_id, save_pr_comment_result
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks

logger = logging.getLogger(__name__)

ENABLED_OPTION_KEY = "sentry:preprod_snapshot_pr_comments_enabled"
POST_ON_ADDED_OPTION_KEY = "sentry:preprod_snapshot_pr_comments_post_on_added"
POST_ON_REMOVED_OPTION_KEY = "sentry:preprod_snapshot_pr_comments_post_on_removed"
POST_ON_CHANGED_OPTION_KEY = "sentry:preprod_snapshot_pr_comments_post_on_changed"
POST_ON_RENAMED_OPTION_KEY = "sentry:preprod_snapshot_pr_comments_post_on_renamed"
FEATURE_FLAG = "organizations:preprod-snapshot-pr-comments"


@instrumented_task(
    name="sentry.preprod.tasks.create_preprod_snapshot_pr_comment",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=5, delay=60 * 5),
)
def create_preprod_snapshot_pr_comment_task(
    preprod_artifact_id: int, caller: str | None = None, **kwargs: Any
) -> None:
    try:
        artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info",
            "commit_comparison",
            "project",
            "project__organization",
        ).get(id=preprod_artifact_id)
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            "preprod.snapshot_pr_comments.create.artifact_not_found",
            extra={"artifact_id": preprod_artifact_id, "caller": caller},
        )
        return

    if not artifact.commit_comparison:
        logger.info(
            "preprod.snapshot_pr_comments.create.no_commit_comparison",
            extra={"artifact_id": artifact.id},
        )
        return

    commit_comparison = artifact.commit_comparison
    if (
        not commit_comparison.pr_number
        or not commit_comparison.head_repo_name
        or not commit_comparison.provider
    ):
        logger.info(
            "preprod.snapshot_pr_comments.create.no_pr_info",
            extra={
                "artifact_id": artifact.id,
                "pr_number": commit_comparison.pr_number,
                "head_repo_name": commit_comparison.head_repo_name,
            },
        )
        return

    if not artifact.project.get_option(ENABLED_OPTION_KEY):
        logger.info(
            "preprod.snapshot_pr_comments.create.project_disabled",
            extra={"artifact_id": artifact.id, "project_id": artifact.project.id},
        )
        return

    organization = artifact.project.organization
    if not features.has(FEATURE_FLAG, organization):
        logger.info(
            "preprod.snapshot_pr_comments.create.feature_disabled",
            extra={"artifact_id": artifact.id, "organization_id": organization.id},
        )
        return

    client = get_commit_context_client(
        organization, commit_comparison.head_repo_name, commit_comparison.provider
    )
    if not client:
        logger.info(
            "preprod.snapshot_pr_comments.create.no_client",
            extra={"artifact_id": artifact.id},
        )
        return

    api_error: Exception | None = None

    with transaction.atomic(router.db_for_write(CommitComparison)):
        all_for_pr = list(
            CommitComparison.objects.select_for_update()
            .filter(
                organization_id=commit_comparison.organization_id,
                head_repo_name=commit_comparison.head_repo_name,
                pr_number=commit_comparison.pr_number,
            )
            .order_by("id")
        )

        try:
            cc = next(c for c in all_for_pr if c.id == commit_comparison.id)
        except StopIteration:
            raise CommitComparison.DoesNotExist(
                f"CommitComparison {commit_comparison.id} was deleted before lock acquisition"
            )

        # Gather snapshot data
        all_artifacts = list(artifact.get_sibling_artifacts_for_commit())

        artifact_ids = [a.id for a in all_artifacts]
        snapshot_metrics_qs = PreprodSnapshotMetrics.objects.filter(
            preprod_artifact_id__in=artifact_ids,
        )
        snapshot_metrics_map: dict[int, PreprodSnapshotMetrics] = {
            m.preprod_artifact_id: m for m in snapshot_metrics_qs
        }

        all_artifacts = [a for a in all_artifacts if a.id in snapshot_metrics_map]
        if not all_artifacts:
            return

        metrics_ids = [m.id for m in snapshot_metrics_map.values()]
        comparisons_qs = PreprodSnapshotComparison.objects.filter(
            head_snapshot_metrics_id__in=metrics_ids,
        )
        comparisons_map: dict[int, PreprodSnapshotComparison] = {
            c.head_snapshot_metrics_id: c for c in comparisons_qs
        }

        approvals_map: dict[int, PreprodComparisonApproval] = {}
        approval_qs = PreprodComparisonApproval.objects.filter(
            preprod_artifact_id__in=artifact_ids,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        )
        for approval in approval_qs:
            approvals_map[approval.preprod_artifact_id] = approval

        base_artifact_map = PreprodArtifact.get_base_artifacts_for_commit(all_artifacts)

        post_on_added = artifact.project.get_option(POST_ON_ADDED_OPTION_KEY, default=False)
        post_on_removed = artifact.project.get_option(POST_ON_REMOVED_OPTION_KEY, default=True)
        post_on_changed = artifact.project.get_option(POST_ON_CHANGED_OPTION_KEY, default=True)
        post_on_renamed = artifact.project.get_option(POST_ON_RENAMED_OPTION_KEY, default=False)
        changes_map = build_changes_map(
            all_artifacts,
            snapshot_metrics_map,
            comparisons_map,
            fail_on_added=post_on_added,
            fail_on_removed=post_on_removed,
            fail_on_changed=post_on_changed,
            fail_on_renamed=post_on_renamed,
        )

        has_changes = any(changes_map.values())
        # Failed comparisons are absent from changes_map (which only tracks
        # SUCCESS state), so check comparisons_map directly to avoid
        # suppressing failure reports.
        has_failures = any(
            c.state == PreprodSnapshotComparison.State.FAILED for c in comparisons_map.values()
        )
        if not has_changes and not has_failures:
            logger.info(
                "preprod.snapshot_pr_comments.create.skipped_no_diff",
                extra={"artifact_id": artifact.id},
            )
            return

        comment_body = format_snapshot_pr_comment(
            all_artifacts,
            snapshot_metrics_map,
            comparisons_map,
            base_artifact_map,
            changes_map,
            approvals_map=approvals_map,
            project=artifact.project,
        )

        existing_comment_id = find_existing_comment_id(all_for_pr, "snapshots")

        try:
            if existing_comment_id:
                client.update_comment(
                    repo=cc.head_repo_name,
                    issue_id=str(cc.pr_number),
                    comment_id=str(existing_comment_id),
                    data={"body": comment_body},
                )
                comment_id = existing_comment_id
                logger.info(
                    "preprod.snapshot_pr_comments.create.updated",
                    extra={"artifact_id": artifact.id, "comment_id": comment_id},
                )
            else:
                resp = client.create_comment(
                    repo=cc.head_repo_name,
                    issue_id=str(cc.pr_number),
                    data={"body": comment_body},
                )
                comment_id = str(resp["id"])
                logger.info(
                    "preprod.snapshot_pr_comments.create.created",
                    extra={"artifact_id": artifact.id, "comment_id": comment_id},
                )
        except Exception as e:
            extra: dict[str, Any] = {
                "artifact_id": artifact.id,
                "organization_id": organization.id,
                "error_type": type(e).__name__,
            }
            if isinstance(e, ApiError):
                extra["status_code"] = e.code
            logger.exception("preprod.snapshot_pr_comments.create.failed", extra=extra)
            save_pr_comment_result(cc, "snapshots", success=False, error=e)
            api_error = e
        else:
            save_pr_comment_result(cc, "snapshots", success=True, comment_id=comment_id)

    if api_error is not None:
        raise api_error
