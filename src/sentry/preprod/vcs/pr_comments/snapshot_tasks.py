from __future__ import annotations

import logging
from typing import Any

from django.db import router, transaction
from taskbroker_client.retry import Retry

from sentry.models.commitcomparison import CommitComparison
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.preprod.integration_utils import get_commit_context_client
from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.snapshots.utils import (
    SnapshotChangeCriteria,
    evaluate_snapshot_changes_by_artifact_id,
)
from sentry.preprod.vcs.pr_comments.snapshot_templates import (
    format_missing_base_snapshot_pr_comment,
    format_snapshot_pr_comment,
    format_solo_snapshot_pr_comment,
    format_waiting_for_base_snapshot_pr_comment,
)
from sentry.preprod.vcs.pr_comments.tasks import (
    lock_pr_comparisons_for_update,
    resolve_pr_comment_context,
    save_pr_comment_result,
)
from sentry.preprod.vcs.status_checks.snapshots.config import (
    get_snapshot_approval_policy,
)
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


def get_snapshot_pr_comment_reporting_criteria(project: Project) -> SnapshotChangeCriteria:
    return SnapshotChangeCriteria(
        added=project.get_option(POST_ON_ADDED_OPTION_KEY, default=False),
        removed=project.get_option(POST_ON_REMOVED_OPTION_KEY, default=True),
        changed=project.get_option(POST_ON_CHANGED_OPTION_KEY, default=True),
        renamed=project.get_option(POST_ON_RENAMED_OPTION_KEY, default=False),
    )


@instrumented_task(
    name="sentry.preprod.tasks.create_preprod_snapshot_pr_comment",
    namespace=preprod_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=3, delay=60),
)
def create_preprod_snapshot_pr_comment_task(
    preprod_artifact_id: int,
    caller: str | None = None,
    is_timeout_check: bool = False,
    **kwargs: Any,
) -> None:
    ctx = resolve_pr_comment_context(
        preprod_artifact_id,
        log_prefix="preprod.snapshot_pr_comments",
        enabled_option_key=ENABLED_OPTION_KEY,
        caller=caller,
        feature_flag=None,
        with_build_configuration=False,
    )
    if ctx is None:
        return
    artifact, commit_comparison, organization, head_repo_name, pr_number, provider = ctx

    client = get_commit_context_client(organization, head_repo_name, provider)
    if not client:
        logger.info(
            "preprod.snapshot_pr_comments.create.no_client",
            extra={"preprod_artifact_id": artifact.id},
        )
        return

    db_alias = router.db_for_write(CommitComparison)

    with transaction.atomic(db_alias):
        cc, existing_comment_id = lock_pr_comparisons_for_update(
            organization_id=commit_comparison.organization_id,
            head_repo_name=head_repo_name,
            pr_number=pr_number,
            target_id=commit_comparison.id,
            comment_type="snapshots",
        )

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

        approvals_by_artifact_id: dict[int, PreprodComparisonApproval] = {}
        approval_qs = PreprodComparisonApproval.objects.filter(
            preprod_artifact_id__in=artifact_ids,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        )
        for approval in approval_qs:
            approvals_by_artifact_id[approval.preprod_artifact_id] = approval

        base_artifact_map = PreprodArtifact.get_base_artifacts_for_commit(all_artifacts)

        is_solo = not base_artifact_map

        cc_id = cc.id

        if is_solo:
            app_ids = {a.app_id for a in all_artifacts if a.app_id}
            has_previous_snapshots = (
                PreprodSnapshotMetrics.objects.filter(
                    preprod_artifact__project_id=artifact.project_id,
                    preprod_artifact__app_id__in=app_ids,
                )
                .exclude(preprod_artifact__commit_comparison_id=commit_comparison.id)
                .exists()
                if app_ids
                else False
            )
            is_first_upload = not has_previous_snapshots

            if is_first_upload or not commit_comparison.base_sha:
                comment_body = format_solo_snapshot_pr_comment(
                    all_artifacts, snapshot_metrics_map, project=artifact.project
                )
            elif not is_timeout_check:
                comment_body = format_waiting_for_base_snapshot_pr_comment(
                    all_artifacts, snapshot_metrics_map, project=artifact.project
                )
            else:
                comment_body = format_missing_base_snapshot_pr_comment(
                    all_artifacts, snapshot_metrics_map, project=artifact.project
                )
        else:
            reporting_criteria = get_snapshot_pr_comment_reporting_criteria(artifact.project)
            reportable_changes_by_artifact_id = evaluate_snapshot_changes_by_artifact_id(
                all_artifacts,
                snapshot_metrics_map,
                comparisons_map,
                reporting_criteria,
            )
            approval_policy = get_snapshot_approval_policy(artifact.project)
            approval_requirements_by_artifact_id = (
                evaluate_snapshot_changes_by_artifact_id(
                    all_artifacts,
                    snapshot_metrics_map,
                    comparisons_map,
                    approval_policy.criteria,
                )
                if approval_policy.enabled
                else {}
            )

            has_reportable_changes = any(reportable_changes_by_artifact_id.values())
            # Failed comparisons and errored images are absent from
            # reportable_changes_by_artifact_id (which only tracks SUCCESS state with diffs), so
            # check comparisons_map directly to avoid suppressing these reports.
            has_failures_or_errors = any(
                c.state == PreprodSnapshotComparison.State.FAILED
                or (c.state == PreprodSnapshotComparison.State.SUCCESS and c.images_errored > 0)
                for c in comparisons_map.values()
            )
            # Suppress brand-new comments on uneventful runs to avoid PR noise.
            if not (has_reportable_changes or has_failures_or_errors or existing_comment_id):
                logger.info(
                    "preprod.snapshot_pr_comments.create.skipped_no_diff",
                    extra={"preprod_artifact_id": artifact.id},
                )
                return

            comment_body = format_snapshot_pr_comment(
                all_artifacts,
                snapshot_metrics_map,
                comparisons_map,
                base_artifact_map,
                reportable_changes_by_artifact_id,
                approval_requirements_by_artifact_id=approval_requirements_by_artifact_id,
                approvals_by_artifact_id=approvals_by_artifact_id,
                project=artifact.project,
            )

    post_snapshot_pr_comment_task.delay(
        organization_id=organization.id,
        repo_name=head_repo_name,
        provider=provider,
        pr_number=pr_number,
        commit_comparison_id=cc_id,
        artifact_id=artifact.id,
        comment_body=comment_body,
    )


@instrumented_task(
    name="sentry.preprod.tasks.post_snapshot_pr_comment",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=3, delay=4, on=(ApiError, ConnectionError, TimeoutError)),
)
def post_snapshot_pr_comment_task(
    *,
    organization_id: int,
    repo_name: str,
    provider: str,
    pr_number: int,
    commit_comparison_id: int,
    artifact_id: int | None = None,
    comment_body: str,
    **kwargs: Any,
) -> None:
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.info(
            "preprod.snapshot_pr_comments.post.org_not_found",
            extra={"organization_id": organization_id},
        )
        return

    client = get_commit_context_client(organization, repo_name, provider)
    if not client:
        logger.info(
            "preprod.snapshot_pr_comments.post.no_client",
            extra={"organization_id": organization_id, "repo_name": repo_name},
        )
        return

    comment_id: str | None = None
    api_error: Exception | None = None
    db_alias = router.db_for_write(CommitComparison)

    try:
        # The comment_id is re-derived under the lock instead of trusting the
        # value passed from the create task: when several artifacts on a commit
        # post at once, each create task reads no existing comment, so the
        # first post here would otherwise create a duplicate comment instead of
        # updating the shared one. The GitHub call is held inside the lock (as
        # in create_preprod_pr_comment_task) so concurrent posters serialize on
        # the decision; lock hold is bounded by the client timeout, which
        # matches this task's processing deadline.
        with transaction.atomic(db_alias):
            cc, comment_id = lock_pr_comparisons_for_update(
                organization_id=organization.id,
                head_repo_name=repo_name,
                pr_number=pr_number,
                target_id=commit_comparison_id,
                comment_type="snapshots",
            )
            is_update = comment_id is not None

            try:
                if comment_id:
                    client.update_comment(
                        repo=repo_name,
                        issue_id=str(pr_number),
                        comment_id=str(comment_id),
                        data={"body": comment_body},
                    )
                else:
                    resp = client.create_comment(
                        repo=repo_name,
                        issue_id=str(pr_number),
                        data={"body": comment_body},
                    )
                    comment_id = str(resp["id"])
            except Exception as e:
                extra: dict[str, Any] = {
                    "commit_comparison_id": commit_comparison_id,
                    "organization_id": organization_id,
                    "error_type": type(e).__name__,
                }
                if isinstance(e, ApiError):
                    extra["status_code"] = e.code
                logger.exception("preprod.snapshot_pr_comments.post.failed", extra=extra)
                api_error = e

            if api_error is not None:
                save_pr_comment_result(cc, "snapshots", success=False, error=api_error)
            else:
                save_pr_comment_result(cc, "snapshots", success=True, comment_id=comment_id)
                logger.info(
                    "preprod.snapshot_pr_comments.post.success",
                    extra={
                        "commit_comparison_id": commit_comparison_id,
                        "organization_id": organization_id,
                        "preprod_artifact_id": artifact_id,
                        "comment_id": comment_id,
                        "repo_name": repo_name,
                        "pr_number": pr_number,
                        "is_update": is_update,
                    },
                )
    except CommitComparison.DoesNotExist:
        logger.info(
            "preprod.snapshot_pr_comments.post.cc_deleted",
            extra={"commit_comparison_id": commit_comparison_id},
        )
        return

    # Re-raised outside the transaction so the failure record is committed
    # before the retry fires. Terminal 4xx (except 429) are swallowed; 429,
    # 5xx, and network errors re-raise to trigger the task's retry policy.
    if api_error is not None:
        if (
            isinstance(api_error, ApiError)
            and api_error.code
            and 400 <= api_error.code < 500
            and api_error.code != 429
        ):
            return
        raise api_error
