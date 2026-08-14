"""
Ingest GitHub ``pull_request_review`` events for Autofix PR iteration.

This is an SCM-platform listener rather than a legacy webhook processor: it
registers on the ``scm_event_stream`` singleton and receives a normalized
``PullRequestReviewEvent`` (see ``sentry/scm/types.py``). A
``pull_request_review`` event fires when a reviewer submits, edits, or dismisses
a review on a pull request; it carries the review ``state``
(``approved`` / ``changes_requested`` / ``commented``) — distinct from a single
inline ``comment`` event.

For the listener to actually receive events it MUST be imported into
``sentry/scm/stream.py``; importing the module is what registers it with the
singleton. Listeners run asynchronously on taskbroker, are isolated from one
another, and take a single ``PullRequestReviewEvent`` argument.

The listener filters to submitted reviews, resolves org/integration/repo context
from the event, feature-gates, and hands off to ``trigger_pr_iteration_from_review``
which fetches the review's inline comments and summary body and dispatches an
Autofix PR iteration. The task gates human review authors on repo write access, so
a human review only drives an iteration when its author could push the change
themselves; bot reviews are instead bounded by the automated-iteration cap.
"""

from __future__ import annotations

import logging

from sentry import features
from sentry.integrations.services.integration import integration_service
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.private.event_stream import scm_event_stream
from sentry.scm.types import PullRequestReviewEvent
from sentry.seer.autofix.pr_iteration.constants import (
    PR_ITERATION_PROVIDER,
    PR_ITERATION_PROVIDER_SLUG,
)

logger = logging.getLogger(__name__)

# We only care about a freshly submitted PR review
_HANDLED_ACTIONS = frozenset({"submitted"})


@scm_event_stream.listen_for(event_type="pull_request_review")
def handle_pull_request_review_for_autofix_iteration(event: PullRequestReviewEvent) -> None:
    """
    SCM listener for ``pull_request_review`` events that triggers an Autofix PR
    iteration from a submitted review.

    GitHub wraps every inline comment in a review (including the standalone
    "Add single comment" path, which fires ``pull_request_review`` with
    ``state: commented``), so acting on submitted reviews covers both batch
    reviews and single inline comments.
    """
    review = event.pull_request_review
    subscription = event.subscription_event

    # GitHub events arrive with ``sentry_meta`` unset, so org/integration/repo
    # context must be resolved from the event. The webhook endpoint surfaces the
    # identifiers needed for that lookup on ``extra`` (see ``get_scm_stream_extra``
    # in ``integrations/github/webhook.py``) so we don't re-parse the raw body.
    extra = subscription.get("extra") or {}
    installation_id = extra.get("installation_id")
    repository_id = extra.get("repository_id")
    # Legacy GitHub Enterprise hosts may deliver without a verified signature, so
    # the payload's author fields are unattested.
    delivery_authenticated = not extra.get("skipped-authentication", False)

    provider = subscription.get("type")
    author_id = event.author.get("id")

    log_extra = {
        "provider": provider,
        "review_id": review.get("id"),
        "review_state": review.get("state"),
        "pull_request_id": review.get("pull_request_id"),
        "author": event.author.get("username"),
        "author_id": author_id,
        "is_bot": event.is_bot,
        "installation_id": installation_id,
        "repository_id": repository_id,
    }

    if event.action not in _HANDLED_ACTIONS:
        logger.debug(
            "autofix.pr_iteration.review_listener.skipped_action",
            extra={**log_extra, "action": event.action},
        )
        return None

    logger.info("autofix.pr_iteration.review_listener.received", extra=log_extra)

    # ``subscription["type"]`` is the integration provider slug, so GitHub
    # Enterprise — which delivers the same ``pull_request_review`` events — is
    # turned away here, before any repo query or control-silo RPC. See
    # ``PR_ITERATION_PROVIDER``.
    if provider != PR_ITERATION_PROVIDER_SLUG:
        logger.warning("autofix.pr_iteration.review_listener.unsupported_provider", extra=log_extra)
        return None

    if installation_id is None or repository_id is None:
        logger.info("autofix.pr_iteration.review_listener.missing_ids", extra=log_extra)
        return None

    # ``pull_request_id`` on the event is the PR *number* (the GitHub REST path
    # uses it); the numeric GitHub PR id needed for the run lookup is recovered
    # in the task via ``get_pull_request``.
    try:
        pr_number = int(review["pull_request_id"])
    except (TypeError, ValueError):
        logger.warning("autofix.pr_iteration.review_listener.bad_pr_number", extra=log_extra)
        return None

    try:
        review_id = int(review["id"])
    except (TypeError, ValueError):
        logger.warning("autofix.pr_iteration.review_listener.bad_review_id", extra=log_extra)
        return None

    # This listener runs in the region with only the two ids, so it resolves the
    # integration (control-silo RPC) and repos (ORM) itself, rather than being
    # handed a resolved org/repo/integration like the legacy comment webhook.
    result = integration_service.organization_contexts(
        external_id=str(installation_id), provider=provider
    )
    integration = result.integration
    installs = result.organization_integrations
    if integration is None or not installs:
        logger.info("autofix.pr_iteration.review_listener.no_integration", extra=log_extra)
        return None

    org_ids = [install.organization_id for install in installs]
    organizations = {org.id: org for org in Organization.objects.filter(id__in=org_ids)}
    repos = Repository.objects.filter(
        organization_id__in=org_ids,
        provider=PR_ITERATION_PROVIDER,
        external_id=str(repository_id),
    )

    dispatched = False
    for repo in repos:
        organization = organizations.get(repo.organization_id)
        if organization is None:
            continue

        repo_log_extra = {**log_extra, "organization_id": organization.id, "repo_id": repo.id}
        if not features.has("organizations:autofix-pr-iteration-manual", organization):
            logger.info(
                "autofix.pr_iteration.review_listener.feature_disabled", extra=repo_log_extra
            )
            continue

        from sentry.tasks.seer.pr_iteration import trigger_pr_iteration_from_review

        logger.info("autofix.pr_iteration.review_listener.scheduled", extra=repo_log_extra)
        trigger_pr_iteration_from_review.delay(
            organization_id=organization.id,
            repo_id=repo.id,
            integration_id=integration.id,
            pr_number=pr_number,
            review_id=review_id,
            author_username=event.author.get("username"),
            author_external_id=event.author.get("id"),
            author_is_bot=event.is_bot,
            delivery_authenticated=delivery_authenticated,
        )
        dispatched = True

    if not dispatched:
        logger.info("autofix.pr_iteration.review_listener.no_repo", extra=log_extra)

    return None
