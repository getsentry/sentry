from __future__ import annotations

import logging
from typing import Any

from sentry import features
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization
from sentry.sentry_apps.utils.webhooks import SizeAnalysisActionType

logger = logging.getLogger(__name__)


def build_webhook_payload(
    artifact: PreprodArtifact,
) -> dict[str, Any] | None:
    """
    Build the size_analysis.completed webhook payload for a given artifact.

    Returns None if the webhook should not be fired (e.g. NOT_RAN state).
    """
    main_metric = (
        PreprodArtifactSizeMetrics.objects.filter(
            preprod_artifact=artifact,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        )
        .select_related("preprod_artifact")
        .first()
    )

    if main_metric is None:
        logger.info(
            "preprod.size_analysis.webhook.no_main_metric",
            extra={"artifact_id": artifact.id},
        )
        return None

    if main_metric.state == PreprodArtifactSizeMetrics.SizeAnalysisState.NOT_RAN:
        return None

    if main_metric.state in (
        PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING,
        PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING,
    ):
        logger.info(
            "preprod.size_analysis.webhook.not_terminal",
            extra={"artifact_id": artifact.id, "state": main_metric.state},
        )
        return None

    analysis_failed = main_metric.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED

    error_code = _map_error_code(main_metric.error_code) if analysis_failed else None
    error_message = main_metric.error_message if analysis_failed else None

    comparison_data = _build_comparison_data(artifact, main_metric)
    git_data = _build_git_data(artifact)

    comparison_failed = comparison_data is not None and comparison_data["status"] == "error"
    status = "error" if analysis_failed or comparison_failed else "success"

    mobile_app_info = artifact.get_mobile_app_info()

    return {
        "buildId": str(artifact.id),
        "status": status,
        "errorCode": error_code,
        "errorMessage": error_message,
        "projectSlug": artifact.project.slug,
        "platform": _get_platform(artifact),
        "artifactType": _get_artifact_type(artifact),
        "downloadSize": main_metric.max_download_size if not analysis_failed else None,
        "installSize": main_metric.max_install_size if not analysis_failed else None,
        "app": {
            "name": mobile_app_info.app_name if mobile_app_info else None,
            "version": mobile_app_info.build_version if mobile_app_info else None,
            "buildNumber": mobile_app_info.build_number if mobile_app_info else None,
        },
        "comparison": comparison_data,
        "git": git_data,
    }


def send_size_analysis_webhook(
    artifact: PreprodArtifact,
    organization_id: int,
) -> None:
    """
    Send the size_analysis.completed webhook for a given artifact, if applicable.

    Checks feature flag, builds the payload, and enqueues via the generic broadcaster.
    """
    organization = artifact.project.organization

    if not features.has("organizations:preprod-size-analysis-webhooks", organization):
        logger.info(
            "preprod.size_analysis.webhook.feature_disabled",
            extra={
                "artifact_id": artifact.id,
                "organization_id": organization_id,
            },
        )
        return

    payload = build_webhook_payload(artifact)
    if payload is None:
        logger.info(
            "preprod.size_analysis.webhook.no_payload",
            extra={"artifact_id": artifact.id},
        )
        return

    event_name = SizeAnalysisActionType.COMPLETED.value

    try:
        broadcast_webhooks_for_organization.delay(
            resource_name="size_analysis",
            event_name=event_name,
            organization_id=organization_id,
            payload=payload,
        )
    except Exception:
        logger.exception(
            "preprod.size_analysis.webhook.broadcast_failed",
            extra={
                "artifact_id": artifact.id,
                "organization_id": organization_id,
                "event_type": SentryAppEventType.SIZE_ANALYSIS_COMPLETED.value,
            },
        )


def _build_comparison_data(
    artifact: PreprodArtifact,
    main_metric: PreprodArtifactSizeMetrics,
) -> dict[str, Any] | None:
    """Build the comparison sub-object, or None if no comparison exists."""
    comparison = (
        PreprodArtifactSizeComparison.objects.filter(
            head_size_analysis=main_metric,
        )
        .select_related("base_size_analysis", "base_size_analysis__preprod_artifact")
        .first()
    )

    if comparison is None:
        return None

    comparison_succeeded = comparison.state == PreprodArtifactSizeComparison.State.SUCCESS
    comparison_status = "success" if comparison_succeeded else "error"

    base_artifact = comparison.base_size_analysis.preprod_artifact

    download_size_change: int | None = None
    install_size_change: int | None = None

    if comparison_succeeded:
        head_download = main_metric.max_download_size
        head_install = main_metric.max_install_size
        base_download = comparison.base_size_analysis.max_download_size
        base_install = comparison.base_size_analysis.max_install_size

        if (
            head_download is not None
            and base_download is not None
            and head_install is not None
            and base_install is not None
        ):
            download_size_change = head_download - base_download
            install_size_change = head_install - base_install

    return {
        "status": comparison_status,
        "baseBuildId": str(base_artifact.id),
        "downloadSizeChange": download_size_change,
        "installSizeChange": install_size_change,
    }


def _build_git_data(artifact: PreprodArtifact) -> dict[str, Any] | None:
    """Build the git sub-object, or None if no git context exists."""
    commit_comparison = artifact.commit_comparison
    if commit_comparison is None:
        return None

    return {
        "headSha": commit_comparison.head_sha,
        "baseSha": commit_comparison.base_sha,
        "headRef": commit_comparison.head_ref,
        "baseRef": commit_comparison.base_ref,
        "repoName": commit_comparison.head_repo_name,
        "prNumber": commit_comparison.pr_number,
    }


def _get_platform(artifact: PreprodArtifact) -> str | None:
    platform = artifact.platform
    if platform is None:
        return None
    return platform.value


def _get_artifact_type(artifact: PreprodArtifact) -> str | None:
    if artifact.artifact_type is None:
        return None
    try:
        return PreprodArtifact.ArtifactType(artifact.artifact_type).to_str()
    except (ValueError, AttributeError):
        return None


def _map_error_code(error_code: int | None) -> str | None:
    """Map the integer error code to the string representation for the webhook."""
    if error_code is None:
        return None
    try:
        return PreprodArtifactSizeMetrics.ErrorCode(error_code).name
    except (ValueError, AttributeError):
        return None
