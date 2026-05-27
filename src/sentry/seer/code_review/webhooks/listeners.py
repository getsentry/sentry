from __future__ import annotations

import logging
from typing import Any

import sentry_sdk

from sentry import features
from sentry.integrations.github.client import GitHubReaction
from sentry.integrations.github.utils import is_github_rate_limit_sensitive
from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.stream import PullRequestEvent, scm_event_stream
from sentry.utils import json

from ..metrics import WebhookFilteredReason, record_webhook_filtered, record_webhook_received
from ..preflight import CodeReviewPreflightService
from ..utils import delete_existing_reactions_and_add_reaction, get_tags
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
    github_event = GithubWebhookType.PULL_REQUEST
    action_value = e.action

    record_webhook_received(github_event, action_value)

    try:
        action = PullRequestAction(action_value)
    except ValueError:
        record_webhook_filtered(
            github_event, action_value, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        return

    if action not in WHITELISTED_ACTIONS:
        record_webhook_filtered(
            github_event, action_value, WebhookFilteredReason.UNSUPPORTED_ACTION
        )
        return

    if action != PullRequestAction.CLOSED and e.pull_request["draft"] is True:
        return

    raw_event: dict[str, Any] = json.loads(e.subscription_event["event"])
    external_id = raw_event.get("installation", {}).get("id")
    if external_id is None:
        return

    result = integration_service.organization_contexts(
        external_id=str(external_id), provider=IntegrationProviderSlug.GITHUB.value
    )
    integration = result.integration
    installs = result.organization_integrations

    if integration is None or not installs:
        return

    orgs = {
        org.id: org
        for org in Organization.objects.filter(
            id__in=[install.organization_id for install in installs]
        )
    }

    repos = Repository.objects.filter(
        organization_id__in=orgs.keys(),
        provider=f"integrations:{IntegrationProviderSlug.GITHUB.value}",
        external_id=e.pull_request["repository_id"],
    )

    for repo in repos:
        organization = orgs.get(repo.organization_id)
        if organization is None:
            continue

        if not features.has("organizations:seer-code-review-scm-listener", organization):
            continue

        _handle_pull_request_for_repo(
            e=e,
            raw_event=raw_event,
            action=action,
            action_value=action_value,
            github_event=github_event,
            organization=organization,
            repo=repo,
            integration=integration,
        )


def _handle_pull_request_for_repo(
    *,
    e: PullRequestEvent,
    raw_event: dict[str, Any],
    action: PullRequestAction,
    action_value: str,
    github_event: GithubWebhookType,
    organization: Organization,
    repo: Repository,
    integration: Any,
) -> None:
    from ..utils import get_pr_author_id

    preflight = CodeReviewPreflightService(
        organization=organization,
        repo=repo,
        integration_id=integration.id,
        pr_author_external_id=get_pr_author_id(raw_event),
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

    tags = get_tags(
        raw_event,
        github_event=github_event.value,
        organization_id=organization.id,
        organization_slug=organization.slug,
        integration_id=integration.id,
    )
    sentry_sdk.set_tags(tags)

    schedule_task(
        github_event=github_event,
        github_event_action=action_value,
        event=raw_event,
        organization=organization,
        repo=repo,
        target_commit_sha=target_commit_sha,
        tags=tags,
    )
