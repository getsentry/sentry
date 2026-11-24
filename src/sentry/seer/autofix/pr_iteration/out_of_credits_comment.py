"""Tell the people on a Seer PR that PR iteration stopped for Seer credits.

A credit stop holds the run's feedback and any push it left undone until the next trigger
after a top-up (see ``out_of_credits``), but nothing on the PR says so. The first stop
posts one comment on each of the run's PRs saying why Seer stopped and how to resume.

One comment per credit stop, however many refusals follow it. The ``SeerRun.extras``
marker is claimed under the row lock *before* posting, so two refusals racing can never
both comment, and a failed post is not retried. The drain clears the marker once an
iteration starts again, so the next stop comments again.

The comment is posted from a task so the GitHub call stays off the webhook and completion
paths that hit the refusal.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from django.utils import timezone
from scm import actions as scm_actions
from scm.types import CreatePullRequestCommentProtocol

from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.constants import SEER_GITHUB_PROVIDERS
from sentry.seer.autofix.pr_iteration.pause import PAUSED_EXTRA
from sentry.seer.autofix.pr_iteration.run_markers import (
    get_run_extra,
    get_seer_run,
    record_run_extras,
)
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Run-level SeerRun.extras key. Set once a credit stop's comment is claimed; cleared when an
# iteration starts again.
OUT_OF_CREDITS_COMMENT_EXTRA = "pr_iteration_out_of_credits_comment"


def out_of_credits_comment_body(organization: Organization, denial_reason: str | None) -> str:
    # Worded like the Autofix UI's PR iteration notice (``seer/outOfCredits/messages.tsx``).
    # ``@sentry <instructions>`` sits in backticks, so this comment never reads as an
    # ``@sentry`` command itself: the mention pattern needs whitespace before ``@sentry``.
    billing_url = organization.absolute_url(f"/settings/{organization.slug}/billing/overview/")
    if denial_reason == "daily_cap_exceeded":
        return (
            "Seer stopped working on this pull request because your organization hit its daily "
            "usage limit. Seer continues the next time it iterates on the pull request.\n\n"
            "Once the limit resets or is raised, comment `@sentry <instructions>` to have Seer "
            f"pick it back up now. You can change the limit in [billing settings]({billing_url})."
        )
    return (
        "Seer stopped working on this pull request because your organization ran out of "
        "credits. Seer continues the next time it iterates on the pull request.\n\n"
        "Once credits are added, comment `@sentry <instructions>` to have Seer pick it back up "
        f"now. Set up auto-reload in [billing settings]({billing_url}) to keep Seer running."
    )


def _record(outcome: str, log_fields: Mapping[str, Any], **extra: Any) -> None:
    metrics.incr("autofix.pr_iteration.out_of_credits_comment", tags={"outcome": outcome})
    logger.info(
        "autofix.pr_iteration.out_of_credits_comment",
        extra={"outcome": outcome, **log_fields, **extra},
    )


def _skip_reason(seer_run: SeerRun) -> str | None:
    if get_run_extra(seer_run, OUT_OF_CREDITS_COMMENT_EXTRA) is not None:
        return "already_commented"
    if get_run_extra(seer_run, PAUSED_EXTRA) is not None:
        # The user said ``@sentry stop iterating``: don't suggest resuming.
        return "paused"
    return None


def queue_out_of_credits_comment(
    *,
    run_id: int,
    organization_id: int,
    state: SeerRunState,
    denial_reason: str | None,
) -> None:
    """Queue the credit stop's comment on the run's PRs, unless the stop already has one or
    the run is paused.

    The checks here are a cheap pre-check so later refusals never enqueue: the task claims
    the marker under the row lock, which is what dedupes.
    """
    from sentry.tasks.seer.pr_iteration import comment_on_out_of_credits

    pr_numbers_by_repo = {
        repo_name: pr_state.pr_number
        for repo_name, pr_state in state.repo_pr_states.items()
        if pr_state.pr_number is not None
    }
    log_fields = {
        "run_id": run_id,
        "organization_id": organization_id,
        "denial_reason": denial_reason,
    }
    if not pr_numbers_by_repo:
        _record("skipped", log_fields, reason="no_pull_request")
        return

    seer_run = get_seer_run(run_id=run_id, organization_id=organization_id)
    if seer_run is None:
        # Legacy runs predating SeerRun mirroring have nowhere to record the comment;
        # staying silent beats commenting on every refusal.
        _record("skipped", log_fields, reason="no_seer_run")
        return

    if (reason := _skip_reason(seer_run)) is not None:
        _record("skipped", log_fields, reason=reason)
        return

    comment_on_out_of_credits.delay(
        run_id=run_id,
        organization_id=organization_id,
        pr_numbers_by_repo=pr_numbers_by_repo,
        denial_reason=denial_reason,
    )
    _record("queued", log_fields)


def _claim_comment(seer_run: SeerRun, *, denial_reason: str | None) -> str | None:
    """Claim the credit stop's comment. None when claimed, else why not."""
    try:
        with record_run_extras(seer_run) as extras:
            if extras.get(OUT_OF_CREDITS_COMMENT_EXTRA) is not None:
                return "raced"
            if extras.get(PAUSED_EXTRA) is not None:
                return "paused"
            extras[OUT_OF_CREDITS_COMMENT_EXTRA] = {
                "denial_reason": denial_reason,
                "claimed_at": timezone.now().isoformat(),
            }
    except SeerRun.DoesNotExist:
        # The run was deleted between the lookup and the marker write.
        return "no_seer_run"
    return None


def _post_comment(
    organization: Organization,
    repository_id: int,
    pr_number: int,
    body: str,
    log_fields: Mapping[str, Any],
) -> None:
    try:
        scm = make_scm(organization.id, repository_id, referrer="seer")
    except Exception:
        logger.exception(
            "autofix.pr_iteration.out_of_credits_comment.scm_init_failed", extra=log_fields
        )
        _record("failed", log_fields, reason="scm_init_failed")
        return

    if not isinstance(scm, CreatePullRequestCommentProtocol):
        _record("failed", log_fields, reason="unsupported_provider")
        return

    try:
        scm_actions.create_pull_request_comment(scm, str(pr_number), body)
    except Exception:
        logger.exception(
            "autofix.pr_iteration.out_of_credits_comment.post_failed", extra=log_fields
        )
        _record("failed", log_fields, reason="post_failed")
        return

    _record("posted", log_fields)


def post_out_of_credits_comment(
    *,
    organization: Organization,
    run_id: int,
    pr_numbers_by_repo: Mapping[str, int],
    denial_reason: str | None,
) -> None:
    """Post the credit stop's comment on each of the run's PRs, claiming it first."""
    log_fields: dict[str, Any] = {
        "run_id": run_id,
        "organization_id": organization.id,
        "denial_reason": denial_reason,
    }
    seer_run = get_seer_run(run_id=run_id, organization_id=organization.id)
    if seer_run is None:
        _record("skipped", log_fields, reason="no_seer_run")
        return

    if (reason := _claim_comment(seer_run, denial_reason=denial_reason)) is not None:
        _record("skipped", log_fields, reason=reason)
        return

    # Org-scoped, so a run can only comment through repos in its own org.
    repository_ids: dict[str, int] = dict(
        Repository.objects.filter(
            organization_id=organization.id,
            provider__in=SEER_GITHUB_PROVIDERS,
            name__in=list(pr_numbers_by_repo),
            status=ObjectStatus.ACTIVE,
        )
        .order_by("name", "id")
        .values_list("name", "id")
    )
    body = out_of_credits_comment_body(organization, denial_reason)
    for repo_name, pr_number in pr_numbers_by_repo.items():
        repository_id = repository_ids.get(repo_name)
        pr_log_fields = {**log_fields, "repository_id": repository_id, "pr_number": pr_number}
        if repository_id is None:
            _record("failed", pr_log_fields, reason="repository_not_found")
            continue
        _post_comment(organization, repository_id, pr_number, body, pr_log_fields)


def clear_out_of_credits_comment(*, run_id: int, organization_id: int) -> None:
    """Forget the last credit stop's comment once an iteration starts, so the next stop
    comments again."""
    seer_run = get_seer_run(run_id=run_id, organization_id=organization_id)
    if seer_run is None or get_run_extra(seer_run, OUT_OF_CREDITS_COMMENT_EXTRA) is None:
        return

    try:
        with record_run_extras(seer_run) as extras:
            extras.pop(OUT_OF_CREDITS_COMMENT_EXTRA, None)
    except SeerRun.DoesNotExist:
        return
