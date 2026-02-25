from __future__ import annotations

import logging
from enum import StrEnum
from typing import Any

from django.db import router, transaction

from sentry import features
from sentry.preprod.build_distribution_utils import is_installable_artifact
from sentry.preprod.integration_utils import get_github_client
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.vcs.pr_comments.templates import format_pr_comment
from sentry.shared_integrations.exceptions import ApiError, IntegrationConfigurationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.preprod.tasks.create_preprod_pr_comment",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
)
def create_preprod_pr_comment_task(
    preprod_artifact_id: int, caller: str | None = None, **kwargs: Any
) -> None:
    try:
        artifact = PreprodArtifact.objects.select_related(
            "mobile_app_info",
            "build_configuration",
            "commit_comparison",
            "project",
            "project__organization",
        ).get(id=preprod_artifact_id)
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            "preprod.pr_comments.create.artifact_not_found",
            extra={"artifact_id": preprod_artifact_id, "caller": caller},
        )
        return

    if not artifact.commit_comparison:
        logger.info(
            "preprod.pr_comments.create.no_commit_comparison",
            extra={"artifact_id": artifact.id},
        )
        return

    commit_comparison = artifact.commit_comparison
    if not commit_comparison.pr_number or not commit_comparison.head_repo_name:
        logger.info(
            "preprod.pr_comments.create.no_pr_info",
            extra={
                "artifact_id": artifact.id,
                "pr_number": commit_comparison.pr_number,
                "head_repo_name": commit_comparison.head_repo_name,
            },
        )
        return

    if commit_comparison.provider != "github":
        logger.info(
            "preprod.pr_comments.create.unsupported_provider",
            extra={"artifact_id": artifact.id, "provider": commit_comparison.provider},
        )
        return

    if not is_installable_artifact(artifact):
        logger.info(
            "preprod.pr_comments.create.not_installable",
            extra={"artifact_id": artifact.id},
        )
        return

    organization = artifact.project.organization
    if not features.has("organizations:preprod-build-distribution", organization):
        logger.info(
            "preprod.pr_comments.create.feature_disabled",
            extra={"artifact_id": artifact.id, "organization_id": organization.id},
        )
        return

    siblings = artifact.get_sibling_artifacts_for_commit()
    installable_siblings = [s for s in siblings if is_installable_artifact(s)]
    if not installable_siblings:
        return

    existing_comment_id = _find_existing_comment_id(installable_siblings)

    client = get_github_client(organization, commit_comparison.head_repo_name)
    if not client:
        logger.info(
            "preprod.pr_comments.create.no_github_client",
            extra={"artifact_id": artifact.id},
        )
        return

    comment_body = format_pr_comment(installable_siblings)

    try:
        if existing_comment_id:
            client.update_comment(
                repo=commit_comparison.head_repo_name,
                issue_id=str(commit_comparison.pr_number),
                comment_id=str(existing_comment_id),
                data={"body": comment_body},
            )
            comment_id = existing_comment_id
            logger.info(
                "preprod.pr_comments.create.updated",
                extra={"artifact_id": artifact.id, "comment_id": comment_id},
            )
        else:
            resp = client.create_comment(
                repo=commit_comparison.head_repo_name,
                issue_id=str(commit_comparison.pr_number),
                data={"body": comment_body},
            )
            comment_id = str(resp["id"])
            logger.info(
                "preprod.pr_comments.create.created",
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
        logger.exception("preprod.pr_comments.create.failed", extra=extra)
        _update_posted_pr_comment(artifact, success=False, error=e)
        raise

    _update_posted_pr_comment(artifact, success=True, comment_id=comment_id)


def _find_existing_comment_id(artifacts: list[PreprodArtifact]) -> str | None:
    for a in artifacts:
        extras = a.extras or {}
        pr_comments = extras.get("posted_pr_comments", {})
        build_dist = pr_comments.get("build_distribution", {})
        comment_id = build_dist.get("comment_id")
        if comment_id and build_dist.get("success"):
            return str(comment_id)
    return None


def _update_posted_pr_comment(
    artifact: PreprodArtifact,
    success: bool,
    comment_id: str | None = None,
    error: Exception | None = None,
) -> None:
    with transaction.atomic(router.db_for_write(PreprodArtifact)):
        fresh = PreprodArtifact.objects.select_for_update().get(id=artifact.id)
        extras = fresh.extras or {}

        posted_pr_comments = extras.get("posted_pr_comments", {})
        result: dict[str, Any] = {"success": success}
        if success and comment_id:
            result["comment_id"] = comment_id
        if not success:
            result["error_type"] = _get_error_type(error)

        posted_pr_comments["build_distribution"] = result
        extras["posted_pr_comments"] = posted_pr_comments
        fresh.extras = extras
        fresh.save(update_fields=["extras"])


class _ErrorType(StrEnum):
    UNKNOWN = "unknown"
    API_ERROR = "api_error"
    INTEGRATION_ERROR = "integration_error"


def _get_error_type(error: Exception | None) -> str:
    if error is None:
        return _ErrorType.UNKNOWN
    if isinstance(error, IntegrationConfigurationError):
        return _ErrorType.INTEGRATION_ERROR
    if isinstance(error, ApiError):
        return _ErrorType.API_ERROR
    return _ErrorType.UNKNOWN
