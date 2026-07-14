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

This is scaffolding: it filters, logs, and leaves the Autofix dispatch as a
follow-up (see the TODO below).
"""

from __future__ import annotations

import logging

from sentry.scm.private.event_stream import scm_event_stream
from sentry.scm.types import PullRequestReviewEvent

logger = logging.getLogger(__name__)

# We only care about a freshly submitted PR review
_HANDLED_ACTIONS = frozenset({"submitted"})


@scm_event_stream.listen_for(event_type="pull_request_review")
def handle_pull_request_review_for_autofix_iteration(event: PullRequestReviewEvent) -> None:
    """
    SCM listener for ``pull_request_review`` events that (eventually) triggers an
    Autofix PR iteration from a submitted review.
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

    log_extra = {
        "provider": subscription.get("type"),
        "review_id": review.get("id"),
        "review_state": review.get("state"),
        "pull_request_id": review.get("pull_request_id"),
        "author": event.author.get("username"),
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

    # A review submitted by our own app is our previous output, not feedback.
    if event.is_bot:
        logger.debug("autofix.pr_iteration.review_listener.skipped_bot", extra=log_extra)
        return None

    logger.info("autofix.pr_iteration.review_listener.received", extra=log_extra)

    # TODO: with installation_id + repository_id in hand, resolve the integration
    # via ``integration_service.organization_contexts`` (control-silo RPC, since
    # this listener runs in the region) and the matching repos via the ORM, then
    # gate on ``organizations:autofix-pr-iteration``, normalize the review into a
    # Feedback source, and dispatch an Autofix PR iteration per (org, repo)
    # (mirror `_dispatch_autofix_iteration_from_comment` in `mention.py`).
    logger.info("autofix.pr_iteration.review_listener.todo_dispatch", extra=log_extra)
    return None
