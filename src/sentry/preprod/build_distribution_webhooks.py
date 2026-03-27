from __future__ import annotations

import logging

from sentry.preprod.api.models.public.installable_builds import (
    BuildDistributionSummaryBuildError,
    BuildDistributionSummaryResponseDict,
    build_build_distribution_summary,
)
from sentry.preprod.models import PreprodArtifact
from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization
from sentry.sentry_apps.utils.webhooks import PreprodArtifactActionType

logger = logging.getLogger(__name__)


def build_webhook_payload(
    artifact: PreprodArtifact,
) -> BuildDistributionSummaryResponseDict | None:
    """
    Build the ``build_distribution.completed`` webhook payload for a given artifact.

    The payload mirrors the public install-info API response, excluding:

    - ``downloadCount``
    - ``releaseNotes``
    - ``installGroups``

    Returns ``None`` if the webhook should not be fired (e.g. non-terminal
    state where neither ``installable_app_file_id`` nor
    ``installable_app_error_code`` is set).
    """
    try:
        head_artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info",
            "build_configuration",
            "commit_comparison",
            "project__organization",
        ).get(id=artifact.id)
    except PreprodArtifact.DoesNotExist:
        logger.warning(
            "preprod.build_distribution.webhook.artifact_not_found",
            extra={"artifact_id": artifact.id},
        )
        return None

    try:
        return build_build_distribution_summary(head_artifact)
    except BuildDistributionSummaryBuildError:
        logger.exception(
            "preprod.build_distribution.webhook.build_error",
            extra={"artifact_id": artifact.id},
        )
        return None


def send_build_distribution_webhook(
    artifact: PreprodArtifact,
    organization_id: int,
) -> None:
    """
    Send the ``build_distribution.completed`` webhook for a given artifact, if applicable.

    Builds the payload and enqueues via the generic broadcaster.
    Fully fire-and-forget: exceptions are logged but never propagated.
    """
    try:
        payload = build_webhook_payload(artifact)
        if payload is None:
            logger.info(
                "preprod.build_distribution.webhook.no_payload",
                extra={"artifact_id": artifact.id},
            )
            return

        broadcast_webhooks_for_organization.delay(
            resource_name="preprod_artifact",
            event_name=PreprodArtifactActionType.BUILD_DISTRIBUTION_COMPLETED.value,
            organization_id=organization_id,
            payload=dict(payload),
        )
    except Exception:
        logger.exception(
            "preprod.build_distribution.webhook.failed",
            extra={
                "artifact_id": artifact.id,
                "organization_id": organization_id,
            },
        )
