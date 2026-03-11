from __future__ import annotations

import logging
from collections.abc import Sequence
from enum import StrEnum
from typing import Any

from django.db import router, transaction

from sentry import features
from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.build_distribution_utils import is_installable_artifact
from sentry.preprod.integration_utils import get_commit_context_client
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.vcs.pr_comments.templates import format_pr_comment
from sentry.shared_integrations.exceptions import ApiError, IntegrationConfigurationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks
from sentry.taskworker.retry import Retry

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.preprod.tasks.create_preprod_pr_comment",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.REGION,
    retry=Retry(times=5, delay=60 * 5),
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
    if (
        not commit_comparison.pr_number
        or not commit_comparison.head_repo_name
        or not commit_comparison.provider
    ):
        logger.info(
            "preprod.pr_comments.create.no_pr_info",
            extra={
                "artifact_id": artifact.id,
                "pr_number": commit_comparison.pr_number,
                "head_repo_name": commit_comparison.head_repo_name,
            },
        )
        return

    organization = artifact.project.organization
    if not features.has("organizations:preprod-build-distribution-pr-comments", organization):
        logger.info(
            "preprod.pr_comments.create.feature_disabled",
            extra={"artifact_id": artifact.id, "organization_id": organization.id},
        )
        return

    client = get_commit_context_client(
        organization, commit_comparison.head_repo_name, commit_comparison.provider
    )
    if not client:
        logger.info(
            "preprod.pr_comments.create.no_client",
            extra={"artifact_id": artifact.id},
        )
        return

    # Lock ALL CommitComparison rows for this PR, ordered by id to prevent
    # deadlocks.  This serializes tasks across different commits on the same
    # PR, preventing duplicate comments when a new commit is pushed before
    # the previous task finishes.
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

        # Fresh read of the current row from the locked set
        cc = next(c for c in all_for_pr if c.id == commit_comparison.id)

        siblings = artifact.get_sibling_artifacts_for_commit()
        installable_siblings = [s for s in siblings if is_installable_artifact(s)]
        if not installable_siblings:
            return

        existing_comment_id = _find_existing_comment_id(all_for_pr)
        comment_body = format_pr_comment(installable_siblings)

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
                    "preprod.pr_comments.create.updated",
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
            _save_pr_comment_result(cc, success=False, error=e)
            api_error = e
        else:
            _save_pr_comment_result(cc, success=True, comment_id=comment_id)

    if api_error is not None:
        raise api_error


def _find_existing_comment_id(
    comparisons: Sequence[CommitComparison],
) -> str | None:
    for cc in comparisons:
        extras = cc.extras or {}
        comment_id = extras.get("pr_comments", {}).get("build_distribution", {}).get("comment_id")
        if comment_id:
            return str(comment_id)
    return None


def _save_pr_comment_result(
    commit_comparison: CommitComparison,
    success: bool,
    comment_id: str | None = None,
    error: Exception | None = None,
) -> None:
    """Save the PR comment result to the commit_comparison row.

    Must be called inside a transaction that already holds a
    select_for_update lock on the commit_comparison row.
    """
    extras = commit_comparison.extras or {}

    # Preserve the existing comment_id on failure so retries use
    # update_comment instead of creating a duplicate.
    if not comment_id:
        existing = extras.get("pr_comments", {}).get("build_distribution", {})
        comment_id = existing.get("comment_id")

    result: dict[str, Any] = {"success": success}
    if comment_id:
        result["comment_id"] = comment_id
    if not success:
        result["error_type"] = _get_error_type(error)

    pr_comments = extras.setdefault("pr_comments", {})
    pr_comments["build_distribution"] = result
    commit_comparison.extras = extras
    commit_comparison.save(update_fields=["extras"])


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
