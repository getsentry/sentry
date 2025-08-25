from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import sentry_sdk

from sentry.constants import ObjectStatus
from sentry.integrations.github.constants import RATE_LIMITED_MESSAGE
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.tasks import pr_comment_workflow
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.pullrequest import PullRequestComment
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import integrations_tasks
from sentry.utils import metrics
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.integrations.github.tasks.github_comment_workflow",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=integrations_tasks,
    ),
)
def github_comment_workflow(pullrequest_id: int, project_id: int):
    # TODO(jianyuan): Using `sentry.integrations.source_code_management.tasks.pr_comment_workflow` now.
    # Keep this task temporarily to avoid breaking changes.
    pr_comment_workflow(pr_id=pullrequest_id, project_id=project_id)


@instrumented_task(
    name="sentry.integrations.github.tasks.github_comment_reactions",
    silo_mode=SiloMode.REGION,
    taskworker_config=TaskworkerConfig(
        namespace=integrations_tasks,
    ),
)
def github_comment_reactions():
    logger.info("github.pr_comment.reactions_task")

    comments = PullRequestComment.objects.filter(
        created_at__gte=datetime.now(tz=timezone.utc) - timedelta(days=30)
    ).select_related("pull_request")

    comment_count = 0

    for comment in RangeQuerySetWrapper(comments):
        pr = comment.pull_request
        try:
            repo = Repository.objects.get(id=pr.repository_id)
        except Repository.DoesNotExist:
            metrics.incr("pr_comment.comment_reactions.missing_repo")
            continue

        # Add check for GitHub provider before proceeding
        # TODO: nuke comment reactions or implement for all providers
        if repo.provider not in (IntegrationProviderSlug.GITHUB.value, "integrations:github"):
            metrics.incr("pr_comment.comment_reactions.skipped_non_github")
            continue

        integration = integration_service.get_integration(
            integration_id=repo.integration_id, status=ObjectStatus.ACTIVE
        )
        if not integration:
            logger.info(
                "pr_comment.comment_reactions.integration_missing",
                extra={
                    "organization_id": pr.organization_id,
                },
            )
            metrics.incr("pr_comment.comment_reactions.missing_integration")
            continue

        installation = integration.get_installation(organization_id=pr.organization_id)

        # GitHubApiClient
        # TODO(cathy): create helper function to fetch client for repo
        client = installation.get_client()

        try:
            reactions = client.get_comment_reactions(repo=repo.name, comment_id=comment.external_id)

            comment.reactions = reactions
            comment.save()
        except ApiError as e:
            if e.json and RATE_LIMITED_MESSAGE in e.json.get("message", ""):
                metrics.incr("pr_comment.comment_reactions.rate_limited_error")
                break

            if e.code == 404:
                metrics.incr("pr_comment.comment_reactions.not_found_error")
            else:
                metrics.incr("pr_comment.comment_reactions.api_error")
                sentry_sdk.capture_exception(e)
            continue

        comment_count += 1

        metrics.incr("pr_comment.comment_reactions.success")

    logger.info("pr_comment.comment_reactions.total_collected", extra={"count": comment_count})
