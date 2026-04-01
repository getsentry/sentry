from __future__ import annotations

import logging

from sentry.preprod.api.models.public.size_analysis import (
    SizeAnalysisSummaryBuildError,
    SizeAnalysisSummaryResponseDict,
    build_size_analysis_summary,
)
from sentry.preprod.models import PreprodArtifact
from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization
from sentry.sentry_apps.utils.webhooks import PreprodArtifactActionType

logger = logging.getLogger(__name__)


def build_webhook_payload(
    artifact: PreprodArtifact,
) -> SizeAnalysisSummaryResponseDict | None:
    """
    Build the ``size_analysis.completed`` webhook payload for a given artifact.

    The payload mirrors the public Size Analysis API response, excluding:

    - ``insights``
    - ``appComponents``
    - ``comparisons[].diffItems``
    - ``comparisons[].insightDiffItems``

    Returns ``None`` if the webhook should not be fired (e.g. PENDING,
    PROCESSING, NOT_RAN states, no size metrics, or unreadable analysis data).
    """
    # Ensure needed relations are loaded for create_app_info_dict / create_git_info_dict
    try:
        head_artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info",
            "build_configuration",
            "commit_comparison",
            "project__organization",
        ).get(id=artifact.id)
    except PreprodArtifact.DoesNotExist:
        logger.warning(
            "preprod.size_analysis.webhook.artifact_not_found",
            extra={"artifact_id": artifact.id},
        )
        return None

    base_artifact = _resolve_base_artifact(head_artifact)

    try:
        return build_size_analysis_summary(
            head_artifact,
            base_artifact=base_artifact,
        )
    except SizeAnalysisSummaryBuildError:
        logger.exception(
            "preprod.size_analysis.webhook.build_error",
            extra={"artifact_id": artifact.id},
        )
        return None


def send_size_analysis_webhook(
    artifact: PreprodArtifact,
    organization_id: int,
) -> None:
    """
    Send the ``size_analysis.completed`` webhook for a given artifact, if applicable.

    Builds the payload and enqueues via the generic broadcaster.
    Fully fire-and-forget: exceptions are logged but never propagated.
    """
    try:
        payload = build_webhook_payload(artifact)
        if payload is None:
            logger.info(
                "preprod.size_analysis.webhook.no_payload",
                extra={"artifact_id": artifact.id},
            )
            return

        broadcast_webhooks_for_organization.delay(
            resource_name="preprod_artifact",
            event_name=PreprodArtifactActionType.SIZE_ANALYSIS_COMPLETED.value,
            organization_id=organization_id,
            payload=dict(payload),
        )
    except Exception:
        logger.exception(
            "preprod.size_analysis.webhook.failed",
            extra={
                "artifact_id": artifact.id,
                "organization_id": organization_id,
            },
        )


def _resolve_base_artifact(head_artifact: PreprodArtifact) -> PreprodArtifact | None:
    """Resolve the default base artifact for comparison, mirroring the public API default path."""
    if not head_artifact.commit_comparison:
        return None

    return (
        head_artifact.get_base_artifact_for_commit()
        .select_related("mobile_app_info", "build_configuration", "commit_comparison")
        .first()
    )
