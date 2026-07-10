from __future__ import annotations

import logging
from typing import Any

from django.db import router, transaction
from taskbroker_client.retry import Retry

from sentry import features
from sentry.models.commitcomparison import CommitComparison
from sentry.preprod.integration_utils import get_commit_context_client
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.vcs.pr_comments.size_templates import format_size_pr_comment
from sentry.preprod.vcs.pr_comments.tasks import (
    lock_pr_comparisons_for_update,
    save_pr_comment_result,
)
from sentry.preprod.vcs.status_checks.size.rules import get_status_check_rules
from sentry.preprod.vcs.status_checks.size.tasks import evaluate_size_and_format_messages
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import preprod_tasks

logger = logging.getLogger(__name__)

COMMENT_TYPE = "size"

ENABLED_OPTION_KEY = "sentry:preprod_size_pr_comments_enabled"
RULES_OPTION_KEY = "sentry:preprod_size_pr_comments_rules"


@instrumented_task(
    name="sentry.preprod.tasks.create_preprod_size_pr_comment",
    namespace=preprod_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.CELL,
    retry=Retry(times=5, delay=60 * 5),
)
def create_preprod_size_pr_comment_task(
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
            "preprod.size_pr_comments.create.artifact_not_found",
            extra={"preprod_artifact_id": preprod_artifact_id, "caller": caller},
        )
        return

    if not artifact.commit_comparison:
        logger.info(
            "preprod.size_pr_comments.create.no_commit_comparison",
            extra={"preprod_artifact_id": artifact.id},
        )
        return

    commit_comparison = artifact.commit_comparison
    if (
        not commit_comparison.pr_number
        or not commit_comparison.head_repo_name
        or not commit_comparison.provider
    ):
        logger.info(
            "preprod.size_pr_comments.create.no_pr_info",
            extra={
                "preprod_artifact_id": artifact.id,
                "pr_number": commit_comparison.pr_number,
                "head_repo_name": commit_comparison.head_repo_name,
            },
        )
        return

    if not artifact.project.get_option(ENABLED_OPTION_KEY):
        logger.info(
            "preprod.size_pr_comments.create.project_disabled",
            extra={"preprod_artifact_id": artifact.id, "project_id": artifact.project.id},
        )
        return

    organization = artifact.project.organization
    if not features.has("organizations:preprod-size-analysis-pr-comments", organization):
        logger.info(
            "preprod.size_pr_comments.create.feature_disabled",
            extra={"preprod_artifact_id": artifact.id, "organization_id": organization.id},
        )
        return

    client = get_commit_context_client(
        organization, commit_comparison.head_repo_name, commit_comparison.provider
    )
    if not client:
        logger.info(
            "preprod.size_pr_comments.create.no_client",
            extra={"preprod_artifact_id": artifact.id},
        )
        return

    # Compute rules, triggered rules, and the comment body BEFORE taking the lock
    # so the (DB-heavy) size evaluation stays out of the locked transaction that
    # holds the GitHub call. Only find-existing -> gate -> post -> save run under
    # the lock.
    all_artifacts = list(artifact.get_sibling_artifacts_for_commit())
    rules = get_status_check_rules(artifact.project, option_key=RULES_OPTION_KEY)
    evaluation = evaluate_size_and_format_messages(artifact.project, all_artifacts, rules)

    # Unlike the status check (which posts a neutral "skipped" check regardless),
    # a comment should only exist when there is size data to report. No evaluated
    # artifacts means every sibling was skipped or had no size metrics.
    if not evaluation.evaluated_artifacts:
        logger.info(
            "preprod.size_pr_comments.create.no_size_data",
            extra={"preprod_artifact_id": artifact.id},
        )
        return

    triggered_rules = evaluation.triggered_rules
    comment_body = format_size_pr_comment(evaluation.title, evaluation.subtitle, evaluation.summary)

    api_error: Exception | None = None

    with transaction.atomic(router.db_for_write(CommitComparison)):
        cc, existing_comment_id = lock_pr_comparisons_for_update(
            organization_id=commit_comparison.organization_id,
            head_repo_name=commit_comparison.head_repo_name,
            pr_number=commit_comparison.pr_number,
            target_id=commit_comparison.id,
            comment_type=COMMENT_TYPE,
        )

        # The trigger check gates first creation only; once a comment exists it is
        # always updated to reflect current state. With no rules configured, post a
        # neutral size summary on every PR (an intentional opt-in, feature is off by
        # default).
        if not existing_comment_id and rules and not triggered_rules:
            logger.info(
                "preprod.size_pr_comments.create.skipped_no_trigger",
                extra={"preprod_artifact_id": artifact.id},
            )
            return

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
                    "preprod.size_pr_comments.create.updated",
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
                    "preprod.size_pr_comments.create.created",
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
            logger.exception("preprod.size_pr_comments.create.failed", extra=extra)
            save_pr_comment_result(cc, COMMENT_TYPE, success=False, error=e)
            api_error = e
        else:
            save_pr_comment_result(cc, COMMENT_TYPE, success=True, comment_id=comment_id)

    if api_error is not None:
        raise api_error
