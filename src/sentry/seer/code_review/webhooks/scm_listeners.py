from typing import cast

import sentry_sdk
from scm.types import CreatePullRequestReactionProtocol, ProviderName, PullRequestAction

from sentry import features
from sentry.integrations.models import Integration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.scm.factory import new as make_scm
from sentry.scm.private.event_stream import scm_event_stream
from sentry.scm.types import PullRequestEvent
from sentry.seer.code_review.metrics import WebhookFilteredReason, record_scm_webhook_filtered
from sentry.seer.code_review.preflight import CodeReviewPreflightService

WHITELISTED_ACTIONS: set[PullRequestAction] = {
    "closed",
    "opened",
    "ready_for_review",
    "synchronize",
}

ACTIONS_REQUIRING_TRIGGER_CHECK: dict[PullRequestAction, CodeReviewTrigger] = {
    "opened": CodeReviewTrigger.ON_READY_FOR_REVIEW,
    "ready_for_review": CodeReviewTrigger.ON_READY_FOR_REVIEW,
    "synchronize": CodeReviewTrigger.ON_NEW_COMMIT,
}

ACTIONS_ELIGIBLE_FOR_EYES_REACTION: set[PullRequestAction] = {
    "opened",
    "ready_for_review",
    "synchronize",
}


@scm_event_stream.listen_for_pull_request
def handle_pull_request_via_scm_stream(e: PullRequestEvent) -> None:
    # Identify the event
    # ##################
    # (associate it with repo, integration, and organization)

    # Colton: this section was adapted from src/sentry/integrations/gitlab/webhooks.py and the beginning of ./handlers.py

    provider = e.subscription_event["type"]
    action = e.action

    if provider == "gitlab":
        sentry_meta = e.subscription_event["sentry_meta"]
        assert sentry_meta is not None
        assert len(sentry_meta) == 1
        organization_id = sentry_meta[0]["organization_id"]
        assert organization_id is not None
        organization = Organization.objects.get(id=organization_id)
        integration_id = sentry_meta[0]["integration_id"]
        assert integration_id is not None
        integration = Integration.objects.get(id=integration_id)
        provider = cast(ProviderName, integration.provider)
        assert provider == "gitlab"
        gitlab_host_name = integration.metadata["domain_name"]
        repository = Repository.objects.get(
            organization_id=organization_id,
            provider=f"integrations:{provider}",
            external_id=f"{gitlab_host_name}:{e.pull_request['repository_id']}",
        )
    else:
        # @todo(When we remove the old handlers for GitHub) Process GitHub webhooks
        return

    # Decide wether to process this event
    # ###################################

    # Colton: the following checks were ported from ./handlers.py

    if integration.provider == IntegrationProviderSlug.GITHUB_ENTERPRISE:
        if not features.has("organizations:seer-code-review-github-enterprise", organization):
            return

    author = e.pull_request.get("author")
    # @todo(NOW) Check what's actually used as `sentry.models.organizationcontributors.OrganizationContributors.external_id`
    # (Currently the preflight can only fail because the PR author is invalid)
    pr_author_external_id = author["username"] if author else None
    preflight = CodeReviewPreflightService(
        organization=organization,
        repo=repository,
        integration_id=integration.id,
        pr_author_external_id=pr_author_external_id,
    ).check()

    if not preflight.allowed:
        if preflight.denial_reason:
            record_scm_webhook_filtered(provider, action, preflight.denial_reason)
            if organization.slug == "sentry":
                sentry_sdk.set_tag("denial_reason", preflight.denial_reason)
        return

    # @todo Avoid processing an event several times in case of duplicated delivery
    # This should be done in the SCM, using delivery ID for GitHub and something equivalent for GitLab

    org_code_review_settings = preflight.settings

    # Colton: the following checks were ported from ./pull_request.py

    if action not in WHITELISTED_ACTIONS:
        record_scm_webhook_filtered(provider, action, WebhookFilteredReason.UNSUPPORTED_ACTION)
        return

    action_requires_trigger_permission = ACTIONS_REQUIRING_TRIGGER_CHECK.get(action)
    if action_requires_trigger_permission is not None and (
        org_code_review_settings is None
        or action_requires_trigger_permission not in org_code_review_settings.triggers
    ):
        record_scm_webhook_filtered(provider, action, WebhookFilteredReason.TRIGGER_DISABLED)
        return

    # If no triggers are configured for this repo, no pr_review was ever sent for it,
    # so there is nothing for Seer to process on close.
    if action == "closed" and (
        org_code_review_settings is None or not org_code_review_settings.triggers
    ):
        record_scm_webhook_filtered(provider, action, WebhookFilteredReason.TRIGGER_DISABLED)
        return

    # Skip draft check for CLOSED actions to ensure Seer receives cleanup notifications
    # even if the PR was converted to draft before closing
    if action != "closed" and e.pull_request["draft"] is True:
        return

    # Process the event
    # #################

    if action in ACTIONS_ELIGIBLE_FOR_EYES_REACTION:
        scm = make_scm(organization_id, repository.id, referrer="seer")
        if isinstance(scm, CreatePullRequestReactionProtocol):
            scm.create_pull_request_reaction(
                pull_request_id=e.pull_request["id"],
                reaction="eyes",
            )

    # Forward the event to Seer
    # #########################

    target_commit_sha = e.pull_request["head"]["sha"]
    if not isinstance(target_commit_sha, str) or not target_commit_sha:
        return

    tags = {
        "scm_provider": e.subscription_event["type"],
        "sentry_integration_id": str(integration_id),
        "sentry_organization_id": str(organization_id),
        "sentry_organization_slug": organization.slug,
        "scm_event_action": action,
    }

    from .task import schedule_scm_task

    schedule_scm_task(
        pull_request_event=e,
        organization=organization,
        repo=repository,
        target_commit_sha=target_commit_sha,
        tags=tags,
    )
