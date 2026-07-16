from __future__ import annotations

import logging
from collections.abc import Sequence
from enum import StrEnum
from typing import Any, NamedTuple

from django.db import router, transaction
from taskbroker_client.retry import Retry

from sentry import features
from sentry.models.commitcomparison import CommitComparison
from sentry.models.organization import Organization
from sentry.preprod.build_distribution_utils import is_installable_artifact
from sentry.preprod.integration_utils import get_commit_context_client
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.vcs.pr_comments.templates import format_pr_comment
from sentry.shared_integrations.exceptions import ApiError, IntegrationConfigurationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks

logger = logging.getLogger(__name__)


class PrCommentContext(NamedTuple):
    artifact: PreprodArtifact
    commit_comparison: CommitComparison
    organization: Organization
    # Validated non-None on the commit comparison by the guard below, surfaced
    # here so callers get the narrowed types at their typed call sites.
    head_repo_name: str
    pr_number: int
    provider: str


def resolve_pr_comment_context(
    preprod_artifact_id: int,
    *,
    log_prefix: str,
    enabled_option_key: str,
    caller: str | None = None,
    feature_flag: str | None = None,
    with_build_configuration: bool = True,
) -> PrCommentContext | None:
    """Resolve common PR-comment inputs after applying the shared task guards.

    Returns ``None`` after logging when the artifact or required PR information
    is missing, the project option is disabled, or the optional feature gate fails.
    """

    def event_name(suffix: str) -> str:
        return log_prefix + ".create." + suffix

    select_related = ["mobile_app_info", "commit_comparison", "project", "project__organization"]
    if with_build_configuration:
        select_related.insert(1, "build_configuration")

    try:
        artifact = PreprodArtifact.objects.select_related(*select_related).get(
            id=preprod_artifact_id
        )
    except PreprodArtifact.DoesNotExist:
        logger.exception(
            event_name("artifact_not_found"),
            extra={"preprod_artifact_id": preprod_artifact_id, "caller": caller},
        )
        return None

    if not artifact.commit_comparison:
        logger.info(event_name("no_commit_comparison"), extra={"preprod_artifact_id": artifact.id})
        return None

    commit_comparison = artifact.commit_comparison
    if (
        not commit_comparison.pr_number
        or not commit_comparison.head_repo_name
        or not commit_comparison.provider
    ):
        logger.info(
            event_name("no_pr_info"),
            extra={
                "preprod_artifact_id": artifact.id,
                "pr_number": commit_comparison.pr_number,
                "head_repo_name": commit_comparison.head_repo_name,
            },
        )
        return None

    if not artifact.project.get_option(enabled_option_key):
        logger.info(
            event_name("project_disabled"),
            extra={"preprod_artifact_id": artifact.id, "project_id": artifact.project.id},
        )
        return None

    organization = artifact.project.organization
    if feature_flag is not None and not features.has(feature_flag, organization):
        logger.info(
            event_name("feature_disabled"),
            extra={"preprod_artifact_id": artifact.id, "organization_id": organization.id},
        )
        return None

    return PrCommentContext(
        artifact,
        commit_comparison,
        organization,
        commit_comparison.head_repo_name,
        commit_comparison.pr_number,
        commit_comparison.provider,
    )


@instrumented_task(
    name="sentry.preprod.tasks.create_preprod_pr_comment",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=5, delay=60 * 5),
)
def create_preprod_pr_comment_task(
    preprod_artifact_id: int, caller: str | None = None, **kwargs: Any
) -> None:
    ctx = resolve_pr_comment_context(
        preprod_artifact_id,
        log_prefix="preprod.pr_comments",
        enabled_option_key="sentry:preprod_distribution_pr_comments_enabled_by_customer",
        caller=caller,
        feature_flag="organizations:preprod-build-distribution-pr-comments",
        with_build_configuration=True,
    )
    if ctx is None:
        return
    artifact, commit_comparison, organization, head_repo_name, pr_number, provider = ctx

    client = get_commit_context_client(organization, head_repo_name, provider)
    if not client:
        logger.info(
            "preprod.pr_comments.create.no_client",
            extra={"preprod_artifact_id": artifact.id},
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

        # Re-read our row from the locked set. The row could theoretically
        # be deleted between the initial fetch and the lock acquisition, but
        # CommitComparison rows are never deleted in practice today.
        try:
            cc = next(c for c in all_for_pr if c.id == commit_comparison.id)
        except StopIteration:
            raise CommitComparison.DoesNotExist(
                f"CommitComparison {commit_comparison.id} was deleted before lock acquisition"
            )

        siblings = artifact.get_sibling_artifacts_for_commit()
        installable_siblings = [s for s in siblings if is_installable_artifact(s)]
        if not installable_siblings:
            logger.info(
                "preprod.pr_comments.create.no_installable_artifacts",
                extra={
                    "preprod_artifact_id": artifact.id,
                    "project_id": artifact.project.id,
                    "sibling_count": len(siblings),
                },
            )
            return

        existing_comment_id = find_existing_comment_id(all_for_pr, "build_distribution")
        comment_body = format_pr_comment(installable_siblings, project=artifact.project)

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
                    extra={"preprod_artifact_id": artifact.id, "comment_id": comment_id},
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
                    extra={"preprod_artifact_id": artifact.id, "comment_id": comment_id},
                )
        except Exception as e:
            extra: dict[str, Any] = {
                "preprod_artifact_id": artifact.id,
                "organization_id": organization.id,
                "error_type": type(e).__name__,
            }
            if isinstance(e, ApiError):
                extra["status_code"] = e.code
            logger.exception("preprod.pr_comments.create.failed", extra=extra)
            save_pr_comment_result(cc, "build_distribution", success=False, error=e)
            api_error = e
        else:
            save_pr_comment_result(cc, "build_distribution", success=True, comment_id=comment_id)

    if api_error is not None:
        raise api_error


def find_existing_comment_id(
    comparisons: Sequence[CommitComparison],
    comment_type: str,
) -> str | None:
    for cc in comparisons:
        extras = cc.extras or {}
        comment_id = extras.get("pr_comments", {}).get(comment_type, {}).get("comment_id")
        if comment_id:
            return str(comment_id)
    return None


def lock_pr_comparisons_for_update(
    *,
    organization_id: int,
    head_repo_name: str,
    pr_number: int,
    target_id: int,
    comment_type: str,
) -> tuple[CommitComparison, str | None]:
    """Lock every CommitComparison row for the PR and return the target row
    along with the existing comment id for ``comment_type``.

    Must be called inside an open transaction. The ``SELECT ... FOR UPDATE``
    serializes tasks operating on the same PR (ordered by id for a stable lock
    order), so the comment id is read from a consistent committed view rather
    than a value captured earlier by another task.
    """
    all_for_pr = list(
        CommitComparison.objects.select_for_update()
        .filter(
            organization_id=organization_id,
            head_repo_name=head_repo_name,
            pr_number=pr_number,
        )
        .order_by("id")
    )
    cc = next((c for c in all_for_pr if c.id == target_id), None)
    if cc is None:
        raise CommitComparison.DoesNotExist(
            f"CommitComparison {target_id} was deleted before lock acquisition"
        )
    return cc, find_existing_comment_id(all_for_pr, comment_type)


def save_pr_comment_result(
    commit_comparison: CommitComparison,
    comment_type: str,
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
        existing = extras.get("pr_comments", {}).get(comment_type, {})
        comment_id = existing.get("comment_id")

    result: dict[str, Any] = {"success": success}
    if comment_id:
        result["comment_id"] = comment_id
    if not success:
        result["error_type"] = _get_error_type(error)

    pr_comments = extras.setdefault("pr_comments", {})
    pr_comments[comment_type] = result
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
