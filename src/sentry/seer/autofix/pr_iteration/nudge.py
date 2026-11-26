"""Tell the user how to ask for an iteration the project gate skipped.

With PR iteration opt-in (see ``feedback_allowed_by_project``), failing CI and
reviews that don't mention ``@sentry`` are skipped without a word on the PR.
The first time that happens on a run, this posts one short comment saying
what was skipped, the command that asks for it on this PR, and where the
setting is.

One comment per run, whatever is skipped after it. The ``SeerRun.extras``
marker is claimed under the row lock *before* posting, so two skips racing
can never both comment. The cost is that a failed post is not retried: the
run stays quiet rather than risk a second comment.

The comment is posted from a task so the GitHub call stays off the webhook
paths that decide the skip.
"""

from __future__ import annotations

import logging
from enum import StrEnum
from typing import Any

from django.utils import timezone
from scm import actions as scm_actions
from scm.types import CreatePullRequestCommentProtocol

from sentry.models.organization import Organization
from sentry.scm.factory import new as make_scm
from sentry.seer.autofix.pr_iteration.pause import PAUSED_EXTRA
from sentry.seer.autofix.pr_iteration.run_markers import (
    get_run_extra,
    get_seer_run,
    record_run_extras,
)
from sentry.seer.models.run import SeerRun
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Run-level SeerRun.extras key. Set once the run's nudge is claimed.
NUDGE_EXTRA = "pr_iteration_nudge"


class NudgeKind(StrEnum):
    CI = "ci"
    REVIEW = "review"


# The commands sit in backticks, so this comment never reads as an ``@sentry``
# command itself: the mention pattern needs whitespace before ``@sentry``.
_WHAT_HAPPENED = {
    NudgeKind.CI: (
        "Auto-Iterate on PRs is off, so Seer didn't fix the failing CI. "
        "Comment `@sentry fix CI` to have Seer fix it."
    ),
    NudgeKind.REVIEW: (
        "Auto-Iterate on PRs is off, so Seer didn't address the latest review. "
        "Comment `@sentry address the latest review` to have Seer address it."
    ),
}


def nudge_comment_body(organization: Organization, kind: NudgeKind) -> str:
    # The org's Seer projects table is where the Auto-Iterate column lives;
    # the per-project Seer page doesn't show it.
    settings_url = organization.absolute_url(f"/settings/{organization.slug}/seer/projects/")
    return (
        f"{_WHAT_HAPPENED[kind]}\n\n"
        f"Turn on Auto-Iterate on PRs in [Seer settings]({settings_url}) "
        "to have Seer handle CI and reviews on its own."
    )


def _record(outcome: str, kind: NudgeKind, log_fields: dict[str, Any], **extra: Any) -> None:
    metrics.incr("autofix.pr_iteration.nudge", tags={"outcome": outcome, "kind": kind.value})
    logger.info("autofix.pr_iteration.nudge", extra={"outcome": outcome, **log_fields, **extra})


def _skip_reason(seer_run: SeerRun) -> str | None:
    if get_run_extra(seer_run, NUDGE_EXTRA) is not None:
        return "already_nudged"
    if get_run_extra(seer_run, PAUSED_EXTRA) is not None:
        # The user said ``@sentry stop iterating``: don't suggest commands.
        return "paused"
    return None


def queue_not_requested_nudge(
    *,
    run_id: int,
    organization_id: int,
    repository_id: int,
    pr_number: int,
    kind: NudgeKind,
) -> None:
    """Queue the run's nudge comment, unless the run is already nudged or paused.

    The checks here are a cheap pre-check so the steady state never enqueues:
    the task claims the marker under the row lock, which is what dedupes.
    """
    from sentry.tasks.seer.pr_iteration import nudge_not_requested_feedback

    log_fields = {
        "run_id": run_id,
        "organization_id": organization_id,
        "repository_id": repository_id,
        "pr_number": pr_number,
        "kind": kind.value,
    }
    seer_run = get_seer_run(run_id=run_id, organization_id=organization_id)
    if seer_run is None:
        # Legacy runs predating SeerRun mirroring have nowhere to record the
        # nudge; staying silent beats commenting on every skip.
        _record("skipped", kind, log_fields, reason="no_seer_run")
        return

    if (reason := _skip_reason(seer_run)) is not None:
        _record("skipped", kind, log_fields, reason=reason)
        return

    nudge_not_requested_feedback.delay(
        run_id=run_id,
        organization_id=organization_id,
        repository_id=repository_id,
        pr_number=pr_number,
        kind=kind.value,
    )
    _record("queued", kind, log_fields)


def _claim_nudge(seer_run: SeerRun, *, kind: NudgeKind, pr_number: int) -> str | None:
    """Claim the run's one nudge. None when claimed, else why not."""
    try:
        with record_run_extras(seer_run) as extras:
            if extras.get(NUDGE_EXTRA) is not None:
                return "raced"
            if extras.get(PAUSED_EXTRA) is not None:
                return "paused"
            extras[NUDGE_EXTRA] = {
                "kind": kind.value,
                "pr_number": pr_number,
                "claimed_at": timezone.now().isoformat(),
            }
    except SeerRun.DoesNotExist:
        # The run was deleted between the lookup and the marker write.
        return "no_seer_run"
    return None


def post_not_requested_nudge(
    *,
    organization: Organization,
    run_id: int,
    repository_id: int,
    pr_number: int,
    kind: NudgeKind,
) -> None:
    """Post the run's one nudge comment, claiming it first."""
    log_fields = {
        "run_id": run_id,
        "organization_id": organization.id,
        "repository_id": repository_id,
        "pr_number": pr_number,
        "kind": kind.value,
    }
    seer_run = get_seer_run(run_id=run_id, organization_id=organization.id)
    if seer_run is None:
        _record("skipped", kind, log_fields, reason="no_seer_run")
        return

    if (reason := _claim_nudge(seer_run, kind=kind, pr_number=pr_number)) is not None:
        _record("skipped", kind, log_fields, reason=reason)
        return

    try:
        scm = make_scm(organization.id, repository_id, referrer="seer")
    except Exception:
        logger.exception("autofix.pr_iteration.nudge.scm_init_failed", extra=log_fields)
        _record("failed", kind, log_fields, reason="scm_init_failed")
        return

    if not isinstance(scm, CreatePullRequestCommentProtocol):
        _record("failed", kind, log_fields, reason="unsupported_provider")
        return

    try:
        scm_actions.create_pull_request_comment(
            scm, str(pr_number), nudge_comment_body(organization, kind)
        )
    except Exception:
        logger.exception("autofix.pr_iteration.nudge.post_failed", extra=log_fields)
        _record("failed", kind, log_fields, reason="post_failed")
        return

    _record("posted", kind, log_fields)
