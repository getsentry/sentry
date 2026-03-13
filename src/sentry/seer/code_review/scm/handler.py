"""
SCM event stream listener for code review.

Provider-agnostic handler that works with any SCM provider flowing through
the event stream. Currently only GitLab produces events here; GitHub uses
its own direct webhook path (seer/code_review/webhooks/).
"""

from __future__ import annotations

import logging

import sentry_sdk

from sentry import features
from sentry.models.organization import Organization
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewSettings, CodeReviewTrigger
from sentry.scm.types import PullRequestAction, PullRequestEvent
from sentry.seer.code_review.preflight import CodeReviewPreflightService

logger = logging.getLogger(__name__)

# Providers that use their own direct webhook path for code review.
# Events from these providers are skipped in this handler.
GITHUB_DIRECT_PATH_PROVIDERS = {"github", "github_enterprise"}

# Provider → feature flag mapping for code review enablement.
# New providers just add an entry here.
PROVIDER_FEATURE_FLAGS: dict[str, str] = {
    "gitlab": "organizations:seer-gitlab-support",
}

# Actions we process for code review
SUPPORTED_ACTIONS: set[PullRequestAction] = {"opened", "synchronize", "closed", "reopened"}

# Mapping from PullRequestAction to CodeReviewTrigger for trigger permission checks
ACTION_TO_TRIGGER: dict[PullRequestAction, CodeReviewTrigger] = {
    "opened": CodeReviewTrigger.ON_READY_FOR_REVIEW,
    "synchronize": CodeReviewTrigger.ON_NEW_COMMIT,
}


def handle_pull_request_for_code_review(event: PullRequestEvent) -> None:
    """Handle a pull request event from the SCM event stream for code review."""
    provider = event.subscription_event["type"]

    # Skip providers that use the direct webhook path
    if provider in GITHUB_DIRECT_PATH_PROVIDERS:
        return

    action = event.action
    if action not in SUPPORTED_ACTIONS:
        return

    sentry_meta = event.subscription_event.get("sentry_meta")
    if not sentry_meta or len(sentry_meta) == 0:
        logger.warning("seer.code_review.scm.missing_sentry_meta", extra={"provider": provider})
        return

    meta = sentry_meta[0]
    organization_id = meta.get("organization_id")
    integration_id = meta.get("integration_id")
    if organization_id is None or integration_id is None:
        logger.warning(
            "seer.code_review.scm.missing_org_or_integration",
            extra={"provider": provider},
        )
        return

    extra = event.subscription_event.get("extra", {})
    repository_id = extra.get("repository_id")
    if not repository_id:
        logger.warning("seer.code_review.scm.missing_repository_id", extra={"provider": provider})
        return

    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "seer.code_review.scm.org_not_found",
            extra={"organization_id": organization_id},
        )
        return

    # Provider-specific feature flag check
    feature_flag = PROVIDER_FEATURE_FLAGS.get(provider)
    if feature_flag and not features.has(feature_flag, organization):
        return

    try:
        repo = Repository.objects.get(id=repository_id, organization_id=organization_id)
    except Repository.DoesNotExist:
        logger.warning(
            "seer.code_review.scm.repo_not_found",
            extra={"repository_id": repository_id, "organization_id": organization_id},
        )
        return

    # Extract PR author ID for preflight billing checks
    pr_author = event.pull_request.get("author")
    pr_author_external_id = pr_author["id"] if pr_author else None

    # Fallback: ensure OrganizationContributors record exists so preflight
    # billing checks don't fail with ORG_CONTRIBUTOR_NOT_FOUND.
    # The primary creation happens in the webhook handler; this is a safety net.
    if pr_author and pr_author_external_id is not None:
        pr_author_username = pr_author.get("username")
        OrganizationContributors.objects.get_or_create(
            organization_id=organization.id,
            integration_id=integration_id,
            external_identifier=pr_author_external_id,
            defaults={"alias": pr_author_username},
        )

    preflight = CodeReviewPreflightService(
        organization=organization,
        repo=repo,
        integration_id=integration_id,
        pr_author_external_id=pr_author_external_id,
    ).check()

    if not preflight.allowed:
        logger.info(
            "seer.code_review.scm.preflight_denied",
            extra={
                "provider": provider,
                "denial_reason": preflight.denial_reason,
                "organization_id": organization_id,
            },
        )
        return

    # Trigger permission check
    settings: CodeReviewSettings | None = preflight.settings
    trigger_required = ACTION_TO_TRIGGER.get(action)
    if trigger_required is not None and (
        settings is None or trigger_required not in settings.triggers
    ):
        return

    # For closed action, skip if no triggers configured (no review was ever sent)
    if action == "closed" and (settings is None or not settings.triggers):
        return

    sentry_sdk.set_tags(
        {
            "scm_provider": provider,
            "sentry_organization_id": str(organization_id),
            "sentry_integration_id": str(integration_id),
        }
    )

    from .task import schedule_scm_code_review_task

    schedule_scm_code_review_task(
        event=event,
        organization=organization,
        repo=repo,
        integration_id=integration_id,
    )
