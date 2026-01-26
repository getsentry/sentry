from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from django.db.models import F, Window
from django.db.models.functions import RowNumber

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.preprod.models import PreprodArtifact, PreprodComparisonApproval
from sentry.preprod.vcs.status_checks.size.tasks import (
    APPROVE_SIZE_ACTION_IDENTIFIER,
    create_preprod_status_check_task,
)
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class Log(StrEnum):
    APPROVE_ACTION_RECEIVED = "preprod.webhook.check_run.approve_action_received"
    MISSING_EXTERNAL_ID = "preprod.webhook.check_run.missing_external_id"
    INVALID_EXTERNAL_ID = "preprod.webhook.check_run.invalid_external_id"
    ARTIFACT_NOT_FOUND = "preprod.webhook.check_run.artifact_not_found"
    APPROVAL_ALREADY_EXISTS = "preprod.webhook.check_run.approval_already_exists"
    APPROVALS_CREATED = "preprod.webhook.check_run.approvals_created"


class GitHubCheckRunAction(StrEnum):
    REQUESTED_ACTION = "requested_action"


def handle_preprod_check_run_event(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration | None = None,
    **kwargs: Any,
) -> None:
    """
    Handle GitHub check_run webhook events for preprod size approval actions.

    Args:
        github_event: The GitHub webhook event type from X-GitHub-Event header
        event: The webhook event payload
        organization: The Sentry organization receiving the webhook
        repo: The repository the webhook is for
        integration: The GitHub integration (unused but required by protocol)
        **kwargs: Additional keyword arguments
    """
    if github_event != GithubWebhookType.CHECK_RUN:
        return

    action = event.get("action")
    if action != GitHubCheckRunAction.REQUESTED_ACTION:
        return

    requested_action = event.get("requested_action", {})
    identifier = requested_action.get("identifier")

    if identifier != APPROVE_SIZE_ACTION_IDENTIFIER:
        return

    check_run = event.get("check_run", {})
    external_id = check_run.get("external_id")
    sender = event.get("sender", {})

    extra = {
        "organization_id": organization.id,
        "external_id": external_id,
        "sender_id": sender.get("id"),
        "action": action,
        "identifier": identifier,
    }

    logger.info(Log.APPROVE_ACTION_RECEIVED, extra=extra)

    if not external_id:
        logger.warning(Log.MISSING_EXTERNAL_ID, extra=extra)
        metrics.incr(Log.MISSING_EXTERNAL_ID)
        return

    try:
        artifact_id = int(external_id)
    except (ValueError, TypeError):
        logger.warning(
            Log.INVALID_EXTERNAL_ID,
            extra={**extra, "external_id_raw": external_id},
        )
        metrics.incr(Log.INVALID_EXTERNAL_ID)
        return

    try:
        artifact = PreprodArtifact.objects.select_related(
            "project__organization", "commit_comparison"
        ).get(id=artifact_id, project__organization=organization)
    except PreprodArtifact.DoesNotExist:
        logger.warning(
            Log.ARTIFACT_NOT_FOUND,
            extra={**extra, "artifact_id": artifact_id},
        )
        metrics.incr(Log.ARTIFACT_NOT_FOUND)
        return

    sibling_artifacts = artifact.get_sibling_artifacts_for_commit()
    if not sibling_artifacts:
        sibling_artifacts = [artifact]

    approvals_created = 0
    github_user_info = {"github": {"id": sender.get("id"), "login": sender.get("login")}}

    # Single query: get latest approval per artifact using window function
    sibling_ids = [s.id for s in sibling_artifacts]
    latest_approvals_qs = (
        PreprodComparisonApproval.objects.filter(
            preprod_artifact_id__in=sibling_ids,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SIZE,
        )
        .annotate(
            row_num=Window(
                expression=RowNumber(),
                partition_by=[F("preprod_artifact_id")],
                order_by=["-id"],
            )
        )
        .filter(row_num=1)
    )

    latest_approval_by_artifact = {
        approval.preprod_artifact_id: approval for approval in latest_approvals_qs
    }

    for sibling in sibling_artifacts:
        latest_approval = latest_approval_by_artifact.get(sibling.id)

        if latest_approval:
            existing_github_id = (latest_approval.extras or {}).get("github", {}).get("id")
            if existing_github_id == sender.get("id"):
                logger.info(
                    Log.APPROVAL_ALREADY_EXISTS,
                    extra={**extra, "sibling_artifact_id": sibling.id},
                )
                continue

        PreprodComparisonApproval.objects.create(
            preprod_artifact=sibling,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SIZE,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
            approved_at=datetime.now(timezone.utc),
            approved_by_id=None,
            extras=github_user_info,
        )
        approvals_created += 1

    logger.info(
        Log.APPROVALS_CREATED,
        extra={
            **extra,
            "artifact_id": artifact_id,
            "sibling_count": len(sibling_artifacts),
            "approvals_created": approvals_created,
        },
    )
    metrics.incr(
        Log.APPROVALS_CREATED,
        amount=approvals_created,
    )

    create_preprod_status_check_task.apply_async(
        kwargs={
            "preprod_artifact_id": artifact.id,
            "caller": "github_approve_webhook",
        }
    )
