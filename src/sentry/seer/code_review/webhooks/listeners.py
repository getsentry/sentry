from __future__ import annotations

import logging
from typing import Any

from sentry import features
from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.github.utils import is_github_rate_limit_sensitive
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.stream import PullRequestEvent, scm_event_stream

from ..metrics import WebhookFilteredReason, record_webhook_filtered
from ..preflight import CodeReviewPreflightService
from ..utils import delete_existing_reactions_and_add_reaction
from .pull_request import (
    ACTIONS_ELIGIBLE_FOR_EYES_REACTION,
    ACTIONS_REQUIRING_TRIGGER_CHECK,
    WHITELISTED_ACTIONS,
    PullRequestAction,
)
from .task import schedule_task

logger = logging.getLogger(__name__)


@scm_event_stream.listen_for_pull_request
def pull_request_listener(e: PullRequestEvent) -> None:
    if e.action not in WHITELISTED_ACTIONS:
        return
    if e.action != PullRequestAction.CLOSED and e.pull_request["draft"] is True:
        return

    integration_ids = [i["integration_id"] for i in e.subscription_event["sentry_meta"]]
    organization_ids = [i["organization_id"] for i in e.subscription_event["sentry_meta"]]

    integrations = {m.id: m for m in Integration.objects.get_many_from_cache(integration_ids)}
    orgs = {org.id: org for org in Organization.objects.get_many_from_cache(organization_ids)}

    repos = Repository.objects.filter(
        organization_id__in=organization_ids,
        provider=f"integrations:{IntegrationProviderSlug.GITHUB.value}",
        external_id=e.pull_request["repository_id"],
    )

    for repo in repos:
        integration = integrations.get(repo)
        if not integration:
            continue

        organization = orgs.get(repo.organization_id)
        if not organization:
            continue
        if not features.has("organizations:seer-code-review-scm-listener", organization):
            continue

        _handle_pull_request_for_repo(
            e=e,
            action=e.action,
            action_value=e.action,
            organization=organization,
            repo=repo,
            integration=integration,
        )


def _handle_pull_request_for_repo(
    *,
    e: PullRequestEvent,
    action: PullRequestAction,
    action_value: str,
    github_event: GithubWebhookType,
    organization: Organization,
    repo: Repository,
    integration: Any,
) -> None:
    preflight = CodeReviewPreflightService(
        organization=organization,
        repo=repo,
        integration_id=integration.id,
        pr_author_external_id=e.pull_request["author"]["id"],
    ).check()

    if not preflight.allowed:
        if preflight.denial_reason:
            record_webhook_filtered(github_event, action_value, preflight.denial_reason)
        return

    org_code_review_settings = preflight.settings

    action_requires_trigger_permission = ACTIONS_REQUIRING_TRIGGER_CHECK.get(action)
    if action_requires_trigger_permission is not None and (
        org_code_review_settings is None
        or action_requires_trigger_permission not in org_code_review_settings.triggers
    ):
        record_webhook_filtered(github_event, action_value, WebhookFilteredReason.TRIGGER_DISABLED)
        return

    if action == PullRequestAction.CLOSED and (
        org_code_review_settings is None or not org_code_review_settings.triggers
    ):
        record_webhook_filtered(github_event, action_value, WebhookFilteredReason.TRIGGER_DISABLED)
        return

    pr_number = e.pull_request["id"]
    if pr_number and action in ACTIONS_ELIGIBLE_FOR_EYES_REACTION:
        reactions_to_delete = [GitHubReaction.HOORAY]
        if is_github_rate_limit_sensitive(organization.slug):
            reactions_to_delete = []

        delete_existing_reactions_and_add_reaction(
            github_event=github_event,
            github_event_action=action_value,
            integration=integration,
            organization_id=organization.id,
            repo=repo,
            pr_number=pr_number,
            comment_id=None,
            reactions_to_delete=reactions_to_delete,
            reaction_to_add=GitHubReaction.EYES,
        )

    target_commit_sha = e.pull_request["head"]["sha"]
    if not target_commit_sha:
        return

    schedule_task(
        github_event=github_event,
        github_event_action=action_value,
        event={},
        organization=organization,
        repo=repo,
        target_commit_sha=target_commit_sha,
        tags={},
    )
