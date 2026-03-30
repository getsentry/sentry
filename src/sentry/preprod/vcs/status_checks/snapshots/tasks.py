from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from sentry.integrations.github.status_check import GitHubCheckStatus
from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodComparisonApproval,
)
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics
from sentry.preprod.url_utils import get_preprod_artifact_url
from sentry.preprod.vcs.status_checks.size.tasks import (
    GITHUB_STATUS_CHECK_STATUS_MAPPING,
    get_status_check_client,
    get_status_check_provider,
    update_posted_status_check,
)
from sentry.preprod.vcs.status_checks.snapshots.templates import (
    format_first_snapshot_status_check_messages,
    format_generated_snapshot_status_check_messages,
    format_missing_base_snapshot_status_check_messages,
    format_snapshot_status_check_messages,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks

logger = logging.getLogger(__name__)

# Action identifier for the "Approve" button on snapshot GitHub check runs.
APPROVE_SNAPSHOT_ACTION_IDENTIFIER = "approve_snapshots"

ENABLED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_enabled"
FAIL_ON_ADDED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_fail_on_added"
FAIL_ON_REMOVED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_fail_on_removed"


@instrumented_task(
    name="sentry.preprod.tasks.create_preprod_snapshot_status_check",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.CELL,
)
def create_preprod_snapshot_status_check_task(
    preprod_artifact_id: int, caller: str | None = None, **kwargs: Any
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
            extra={"artifact_id": preprod_artifact_id, "caller": caller},
        )
        return

    if not preprod_artifact or not isinstance(preprod_artifact, PreprodArtifact):
        logger.error(
            "preprod.snapshot_status_checks.create.artifact_not_found",
            extra={"artifact_id": preprod_artifact_id, "caller": caller},
        )
        return

    logger.info(
        "preprod.snapshot_status_checks.create.start",
        extra={"artifact_id": preprod_artifact.id, "caller": caller},
    )

    if not preprod_artifact.commit_comparison:
        logger.info(
            "preprod.snapshot_status_checks.create.no_commit_comparison",
            extra={"artifact_id": preprod_artifact.id},
        )
        return

    commit_comparison: CommitComparison = preprod_artifact.commit_comparison
    if not commit_comparison.head_sha or not commit_comparison.head_repo_name:
        logger.error(
            "preprod.snapshot_status_checks.create.missing_git_info",
            extra={
                "artifact_id": preprod_artifact.id,
                "commit_comparison_id": commit_comparison.id,
            },
        )
        return

    status_checks_enabled = preprod_artifact.project.get_option(ENABLED_OPTION_KEY, default=True)
    if not status_checks_enabled:
        logger.info(
            "preprod.snapshot_status_checks.create.disabled",
            extra={
                "artifact_id": preprod_artifact.id,
                "project_id": preprod_artifact.project.id,
            },
        )
        return

    fail_on_added = preprod_artifact.project.get_option(FAIL_ON_ADDED_OPTION_KEY, default=False)
    fail_on_removed = preprod_artifact.project.get_option(FAIL_ON_REMOVED_OPTION_KEY, default=True)

    all_artifacts = list(preprod_artifact.get_sibling_artifacts_for_commit())

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
            extra={"artifact_id": preprod_artifact.id},
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
    approve_action_identifier: str | None = None

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
            )
        elif commit_comparison.base_sha:
            status = StatusCheckStatus.FAILURE
            title, subtitle, summary = format_missing_base_snapshot_status_check_messages(
                all_artifacts,
                snapshot_metrics_map,
            )
        else:
            status = StatusCheckStatus.SUCCESS
            title, subtitle, summary = format_generated_snapshot_status_check_messages(
                all_artifacts,
                snapshot_metrics_map,
            )
    else:
        changes_map = _build_changes_map(
            all_artifacts,
            snapshot_metrics_map,
            comparisons_map,
            fail_on_added=fail_on_added,
            fail_on_removed=fail_on_removed,
        )
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
        )
        if any(changes_map.values()):
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

    try:
        check_id = provider.create_status_check(
            repo=commit_comparison.head_repo_name,
            sha=commit_comparison.head_sha,
            status=status,
            title=title,
            subtitle=subtitle,
            text=None,
            summary=summary,
            external_id=str(preprod_artifact.id),
            target_url=target_url,
            started_at=preprod_artifact.date_added,
            completed_at=completed_at,
            approve_action_identifier=approve_action_identifier,
        )
    except Exception as e:
        extra: dict[str, Any] = {
            "artifact_id": preprod_artifact.id,
            "organization_id": preprod_artifact.project.organization_id,
            "organization_slug": preprod_artifact.project.organization.slug,
            "error_type": type(e).__name__,
        }
        if isinstance(e, ApiError):
            extra["status_code"] = e.code
        logger.exception(
            "preprod.snapshot_status_checks.create.failed",
            extra=extra,
        )
        update_posted_status_check(preprod_artifact, check_type="snapshots", success=False, error=e)
        raise

    if check_id is None:
        logger.error(
            "preprod.snapshot_status_checks.create.failed",
            extra={
                "artifact_id": preprod_artifact.id,
                "organization_id": preprod_artifact.project.organization_id,
                "organization_slug": preprod_artifact.project.organization.slug,
                "error_type": "null_check_id",
            },
        )
        update_posted_status_check(preprod_artifact, check_type="snapshots", success=False)
        return

    update_posted_status_check(
        preprod_artifact, check_type="snapshots", success=True, check_id=check_id
    )

    logger.info(
        "preprod.snapshot_status_checks.create.success",
        extra={
            "artifact_id": preprod_artifact.id,
            "status": status.value,
            "check_id": check_id,
            "organization_id": preprod_artifact.project.organization_id,
            "organization_slug": preprod_artifact.project.organization.slug,
        },
    )


def _comparison_has_changes(
    comparison: PreprodSnapshotComparison,
    fail_on_added: bool = False,
    fail_on_removed: bool = True,
) -> bool:
    return (
        comparison.images_changed > 0
        or comparison.images_renamed > 0
        or (fail_on_added and comparison.images_added > 0)
        or (fail_on_removed and comparison.images_removed > 0)
    )


def _build_changes_map(
    artifacts: list[PreprodArtifact],
    snapshot_metrics_map: dict[int, PreprodSnapshotMetrics],
    comparisons_map: dict[int, PreprodSnapshotComparison],
    fail_on_added: bool = False,
    fail_on_removed: bool = True,
) -> dict[int, bool]:
    changes_map: dict[int, bool] = {}
    for artifact in artifacts:
        metrics = snapshot_metrics_map.get(artifact.id)
        if not metrics:
            continue
        comparison = comparisons_map.get(metrics.id)
        if not comparison or comparison.state != PreprodSnapshotComparison.State.SUCCESS:
            continue
        changes_map[artifact.id] = _comparison_has_changes(
            comparison, fail_on_added, fail_on_removed
        )
    return changes_map


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
