from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from taskbroker_client.retry import Retry

from sentry.integrations.github.status_check import GitHubCheckStatus
from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodComparisonApproval,
)
from sentry.preprod.snapshots.constants import MISSING_BASE_GRACE_PERIOD_SECONDS
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.snapshots.utils import evaluate_snapshot_changes_by_artifact_id
from sentry.preprod.url_utils import get_preprod_artifact_url
from sentry.preprod.vcs.status_checks.snapshots.config import (
    get_snapshot_approval_policy,
)
from sentry.preprod.vcs.status_checks.snapshots.templates import (
    format_first_snapshot_status_check_messages,
    format_generated_snapshot_status_check_messages,
    format_missing_base_snapshot_status_check_messages,
    format_snapshot_status_check_messages,
    format_waiting_for_base_snapshot_status_check_messages,
)
from sentry.preprod.vcs.status_checks.status_check_provider import (
    GITHUB_STATUS_CHECK_STATUS_MAPPING,
)
from sentry.preprod.vcs.status_checks.utils import (
    get_status_check_client,
    get_status_check_provider,
    update_posted_status_check,
)
from sentry.preprod.vcs.tasks import update_preprod_snapshot_vcs
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks

logger = logging.getLogger(__name__)

# Action identifier for the "Approve" button on snapshot GitHub check runs.
APPROVE_SNAPSHOT_ACTION_IDENTIFIER = "approve_snapshots"


@instrumented_task(
    name="sentry.preprod.tasks.create_preprod_snapshot_status_check",
    namespace=preprod_tasks,
    processing_deadline_duration=60,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=3, delay=60),
)
def create_preprod_snapshot_status_check_task(
    preprod_artifact_id: int,
    caller: str | None = None,
    is_timeout_check: bool = False,
    **kwargs: Any,
) -> None:
    try:
        preprod_artifact: PreprodArtifact | None = PreprodArtifact.objects.select_related(
            "mobile_app_info",
            "commit_comparison",
            "project",
            "project__organization",
        ).get(id=preprod_artifact_id)
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            "preprod.snapshot_status_checks.create.artifact_not_found",
            extra={"preprod_artifact_id": preprod_artifact_id, "caller": caller},
        )
        return

    if not preprod_artifact or not isinstance(preprod_artifact, PreprodArtifact):
        logger.error(
            "preprod.snapshot_status_checks.create.artifact_not_found",
            extra={"preprod_artifact_id": preprod_artifact_id, "caller": caller},
        )
        return

    logger.info(
        "preprod.snapshot_status_checks.create.start",
        extra={"preprod_artifact_id": preprod_artifact.id, "caller": caller},
    )

    if not preprod_artifact.commit_comparison:
        logger.info(
            "preprod.snapshot_status_checks.create.no_commit_comparison",
            extra={"preprod_artifact_id": preprod_artifact.id},
        )
        return

    commit_comparison: CommitComparison = preprod_artifact.commit_comparison
    if not commit_comparison.head_sha or not commit_comparison.head_repo_name:
        logger.error(
            "preprod.snapshot_status_checks.create.missing_git_info",
            extra={
                "preprod_artifact_id": preprod_artifact.id,
                "commit_comparison_id": commit_comparison.id,
            },
        )
        return

    approval_policy = get_snapshot_approval_policy(preprod_artifact.project)
    if not approval_policy.enabled:
        logger.info(
            "preprod.snapshot_status_checks.create.disabled",
            extra={
                "preprod_artifact_id": preprod_artifact.id,
                "project_id": preprod_artifact.project.id,
            },
        )
        return

    all_artifacts = list(preprod_artifact.get_sibling_artifacts_for_commit())

    artifact_ids = [a.id for a in all_artifacts]
    snapshot_metrics_qs = PreprodSnapshotMetrics.objects.filter(
        preprod_artifact_id__in=artifact_ids,
    )
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics] = {
        m.preprod_artifact_id: m for m in snapshot_metrics_qs
    }

    all_artifacts = [a for a in all_artifacts if a.id in snapshot_metrics_map]
    if not all_artifacts:
        logger.info(
            "preprod.snapshot_status_checks.create.no_snapshot_metrics",
            extra={"preprod_artifact_id": preprod_artifact.id},
        )
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

    is_solo = not base_artifact_map

    if not is_solo:
        changes_map = evaluate_snapshot_changes_by_artifact_id(
            all_artifacts,
            snapshot_metrics_map,
            comparisons_map,
            approval_policy.criteria,
        )
        for artifact in all_artifacts:
            if changes_map.get(artifact.id, False) and artifact.id not in approvals_map:
                # exists()+create() instead of get_or_create: no unique constraint
                # on this model, so duplicates from races are harmless (cleaned
                # up by filter().delete()), while get_or_create would crash with
                # MultipleObjectsReturned if duplicates already exist.
                if not PreprodComparisonApproval.objects.filter(
                    preprod_artifact=artifact,
                    preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
                    approval_status=PreprodComparisonApproval.ApprovalStatus.NEEDS_APPROVAL,
                ).exists():
                    PreprodComparisonApproval.objects.create(
                        preprod_artifact=artifact,
                        preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
                        approval_status=PreprodComparisonApproval.ApprovalStatus.NEEDS_APPROVAL,
                    )

    client, repository = get_status_check_client(preprod_artifact.project, commit_comparison)
    if not client or not repository:
        return

    provider = get_status_check_provider(
        client,
        commit_comparison.provider,
        preprod_artifact.project.organization_id,
        preprod_artifact.project.organization.slug,
        repository.integration_id,
    )
    if not provider:
        logger.info(
            "preprod.snapshot_status_checks.create.not_supported_provider",
            extra={"provider": commit_comparison.provider},
        )
        return

    approve_action_identifier: str | None = None
    waiting_for_base = False

    if is_solo:
        app_ids = {a.app_id for a in all_artifacts if a.app_id}
        has_previous_snapshots = (
            PreprodSnapshotMetrics.objects.filter(
                preprod_artifact__project_id=preprod_artifact.project_id,
                preprod_artifact__app_id__in=app_ids,
            )
            .exclude(preprod_artifact__commit_comparison_id=commit_comparison.id)
            .exists()
            if app_ids
            else False
        )
        is_first_upload = not has_previous_snapshots

        if is_first_upload:
            status = StatusCheckStatus.SUCCESS
            title, subtitle, summary = format_first_snapshot_status_check_messages(
                all_artifacts,
                snapshot_metrics_map,
                project=preprod_artifact.project,
            )
        elif commit_comparison.base_sha:
            if not is_timeout_check:
                waiting_for_base = True
                status = StatusCheckStatus.IN_PROGRESS
                title, subtitle, summary = format_waiting_for_base_snapshot_status_check_messages(
                    all_artifacts,
                    snapshot_metrics_map,
                    project=preprod_artifact.project,
                )
                logger.info(
                    "preprod.snapshot_status_checks.create.missing_base_grace_period",
                    extra={
                        "preprod_artifact_id": preprod_artifact.id,
                        "countdown": MISSING_BASE_GRACE_PERIOD_SECONDS,
                    },
                )
            else:
                status = StatusCheckStatus.FAILURE
                title, subtitle, summary = format_missing_base_snapshot_status_check_messages(
                    all_artifacts,
                    snapshot_metrics_map,
                    project=preprod_artifact.project,
                )
        else:
            status = StatusCheckStatus.SUCCESS
            title, subtitle, summary = format_generated_snapshot_status_check_messages(
                all_artifacts,
                snapshot_metrics_map,
                project=preprod_artifact.project,
            )
    else:
        status = _compute_snapshot_status(
            all_artifacts,
            snapshot_metrics_map,
            comparisons_map,
            approvals_map,
            changes_map,
        )

        title, subtitle, summary = format_snapshot_status_check_messages(
            all_artifacts,
            snapshot_metrics_map,
            comparisons_map,
            status,
            base_artifact_map,
            changes_map,
            project=preprod_artifact.project,
            approvals_map=approvals_map,
        )
        has_unapproved_changes = any(
            has_changes and artifact_id not in approvals_map
            for artifact_id, has_changes in changes_map.items()
        )
        if has_unapproved_changes:
            approve_action_identifier = APPROVE_SNAPSHOT_ACTION_IDENTIFIER

    completed_at: datetime | None = None
    if GITHUB_STATUS_CHECK_STATUS_MAPPING[status] == GitHubCheckStatus.COMPLETED:
        completed_at = preprod_artifact.date_updated

    url_artifact = (
        preprod_artifact
        if preprod_artifact.id in {a.id for a in all_artifacts}
        else all_artifacts[0]
    )
    target_url = get_preprod_artifact_url(url_artifact, view_type="snapshots")

    post_snapshot_status_check_task.delay(
        preprod_artifact_id=preprod_artifact.id,
        status=status.value,
        title=title,
        subtitle=subtitle,
        summary=summary,
        external_id=str(preprod_artifact.id),
        started_at_iso=preprod_artifact.date_added.isoformat(),
        completed_at_iso=completed_at.isoformat() if completed_at else None,
        target_url=target_url,
        approve_action_identifier=approve_action_identifier,
    )

    if waiting_for_base:
        update_preprod_snapshot_vcs(
            preprod_artifact_id=preprod_artifact_id,
            caller="missing_base_timeout",
            is_timeout_check=True,
            countdown=MISSING_BASE_GRACE_PERIOD_SECONDS,
        )


def _compute_snapshot_status(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    comparisons_map: dict[int, PreprodSnapshotComparison],
    approvals_map: dict[int, PreprodComparisonApproval],
    changes_map: dict[int, bool],
) -> StatusCheckStatus:
    has_in_progress = False

    for artifact in artifacts:
        metrics = snapshot_metrics_map.get(artifact.id)
        comparison = metrics and comparisons_map.get(metrics.id)

        if not comparison:
            has_in_progress = True
            continue

        match comparison.state:
            case (
                PreprodSnapshotComparison.State.PENDING | PreprodSnapshotComparison.State.PROCESSING
            ):
                has_in_progress = True
            case PreprodSnapshotComparison.State.FAILED:
                return StatusCheckStatus.FAILURE
            case PreprodSnapshotComparison.State.SUCCESS:
                if changes_map.get(artifact.id, False) and artifact.id not in approvals_map:
                    return StatusCheckStatus.FAILURE

    if has_in_progress:
        return StatusCheckStatus.IN_PROGRESS

    return StatusCheckStatus.SUCCESS


@instrumented_task(
    name="sentry.preprod.tasks.post_snapshot_status_check",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=3, delay=4, on=(ApiError, ConnectionError, TimeoutError)),
)
def post_snapshot_status_check_task(
    *,
    preprod_artifact_id: int,
    status: str,
    title: str,
    subtitle: str,
    summary: str,
    external_id: str,
    started_at_iso: str,
    completed_at_iso: str | None,
    target_url: str | None,
    approve_action_identifier: str | None,
    **kwargs: Any,
) -> None:
    try:
        preprod_artifact = PreprodArtifact.objects.select_related(
            "commit_comparison",
            "project",
            "project__organization",
        ).get(id=preprod_artifact_id)
    except PreprodArtifact.DoesNotExist:
        logger.info(
            "preprod.snapshot_status_checks.post.artifact_not_found",
            extra={"preprod_artifact_id": preprod_artifact_id},
        )
        return

    commit_comparison = preprod_artifact.commit_comparison
    if not commit_comparison:
        logger.info(
            "preprod.snapshot_status_checks.post.no_commit_comparison",
            extra={"preprod_artifact_id": preprod_artifact_id},
        )
        return

    client, repository = get_status_check_client(preprod_artifact.project, commit_comparison)
    if not client or not repository:
        return

    provider = get_status_check_provider(
        client,
        commit_comparison.provider,
        preprod_artifact.project.organization_id,
        preprod_artifact.project.organization.slug,
        repository.integration_id,
    )
    if not provider:
        logger.info(
            "preprod.snapshot_status_checks.post.not_supported_provider",
            extra={"provider": commit_comparison.provider},
        )
        return

    started_at = datetime.fromisoformat(started_at_iso)
    completed_at = datetime.fromisoformat(completed_at_iso) if completed_at_iso else None
    status_enum = StatusCheckStatus(status)

    if status_enum == StatusCheckStatus.IN_PROGRESS:
        has_terminal_comparison = PreprodSnapshotComparison.objects.filter(
            head_snapshot_metrics__preprod_artifact_id=preprod_artifact_id,
            state__in=[
                PreprodSnapshotComparison.State.SUCCESS,
                PreprodSnapshotComparison.State.FAILED,
            ],
        ).exists()
        if has_terminal_comparison:
            logger.info(
                "preprod.snapshot_status_checks.post.skipped_stale_in_progress",
                extra={"preprod_artifact_id": preprod_artifact_id},
            )
            return

    if (
        status_enum == StatusCheckStatus.FAILURE
        and preprod_artifact.commit_comparison_id is not None
    ):
        superseded = (
            PreprodArtifact.objects.filter(
                commit_comparison_id=preprod_artifact.commit_comparison_id,
                # commit_comparison is org-scoped (shared across projects building the same
                # repo/SHA), so scope to this project too — a success in a sibling project
                # must not suppress this project's failure check.
                project_id=preprod_artifact.project_id,
                app_id=preprod_artifact.app_id,
                artifact_type=preprod_artifact.artifact_type,
                build_configuration_id=preprod_artifact.build_configuration_id,
                date_added__gt=preprod_artifact.date_added,
                # Only a newer SUCCESS supersedes: an in-flight (PENDING/PROCESSING) sibling
                # will post its own result when it finishes, so suppressing on those risks a
                # hung newer attempt silently swallowing this legitimate failure forever.
                preprodsnapshotmetrics__snapshot_comparisons_head_metrics__state=(
                    PreprodSnapshotComparison.State.SUCCESS
                ),
            )
            .exclude(id=preprod_artifact_id)
            .exists()
        )
        if superseded:
            logger.info(
                "preprod.snapshot_status_checks.post.skipped_superseded_failure",
                extra={"preprod_artifact_id": preprod_artifact_id},
            )
            return

    try:
        check_id = provider.create_status_check(
            repo=commit_comparison.head_repo_name,
            sha=commit_comparison.head_sha,
            status=status_enum,
            title=title,
            subtitle=subtitle,
            text=None,
            summary=summary,
            external_id=external_id,
            target_url=target_url,
            started_at=started_at,
            completed_at=completed_at,
            approve_action_identifier=approve_action_identifier,
        )
    except Exception as e:
        extra: dict[str, Any] = {
            "preprod_artifact_id": preprod_artifact.id,
            "organization_id": preprod_artifact.project.organization_id,
            "organization_slug": preprod_artifact.project.organization.slug,
            "error_type": type(e).__name__,
        }
        if isinstance(e, ApiError):
            extra["status_code"] = e.code
        logger.exception("preprod.snapshot_status_checks.post.failed", extra=extra)
        update_posted_status_check(preprod_artifact, check_type="snapshots", success=False, error=e)
        if isinstance(e, ApiError) and e.code and 400 <= e.code < 500 and e.code != 429:
            return
        raise

    if check_id is None:
        logger.error(
            "preprod.snapshot_status_checks.post.null_check_id",
            extra={"preprod_artifact_id": preprod_artifact.id},
        )
        update_posted_status_check(preprod_artifact, check_type="snapshots", success=False)
        return

    update_posted_status_check(
        preprod_artifact, check_type="snapshots", success=True, check_id=check_id
    )
    logger.info(
        "preprod.snapshot_status_checks.post.success",
        extra={
            "preprod_artifact_id": preprod_artifact.id,
            "organization_id": preprod_artifact.project.organization_id,
            "organization_slug": preprod_artifact.project.organization.slug,
            "check_id": check_id,
            "status": status,
            "subtitle": subtitle,
            "repo": commit_comparison.head_repo_name,
            "sha": commit_comparison.head_sha,
        },
    )
