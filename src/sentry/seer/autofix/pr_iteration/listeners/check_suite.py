import logging

import orjson
import sentry_sdk
from pydantic import ValidationError

from sentry.scm.private.event_stream import scm_event_stream
from sentry.scm.types import CheckSuiteEvent
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.cap_exhausted import assign_user_for_exhausted_cap
from sentry.seer.autofix.pr_iteration.check_suites import (
    FAILURE_CONCLUSIONS,
    GREEN_CONCLUSIONS,
    READY_FOR_REVIEW_EXTRA,
    REVIEW_REQUESTS_EXTRA,
    ResolvedGreenCheckSuite,
    confirm_green_check_suite,
    green_review_side_effects_enabled,
    resolve_green_check_suite,
    should_defer_pr_iteration,
)
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import (
    CheckSuiteFeedbackSource,
    MissingCheckSuiteAutofixRun,
)
from sentry.seer.autofix.pr_iteration.queue import (
    peek_queued_autofix_feedback,
    try_enqueue_autofix_feedback,
)
from sentry.seer.autofix.pr_iteration.ready_for_review import mark_ready_for_review
from sentry.seer.autofix.pr_iteration.review_request import request_review_from_context
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker

logger = logging.getLogger(__name__)


def _retrigger_deferred_iteration(resolved: ResolvedGreenCheckSuite) -> None:
    """Pull forward consume if this head has parked check-suite feedback.

    Bail on rate-limit-sensitive orgs before the peek, since the sweep in
    ``should_defer_pr_iteration`` is the only reason to look; otherwise peek
    first so there is no GitHub call unless the queue already holds check-suite
    feedback on this head. One parked item is enough to ask: the deferral is
    per-head, not per-item, and re-scheduling per green suite would pile up one
    consume per CI app. ``should_consume`` drops items whose head no longer
    matches the run.
    """
    from sentry.integrations.github.utils import is_github_rate_limit_sensitive

    if is_github_rate_limit_sensitive(resolved.organization.slug):
        return

    run_state = resolved.autofix_run.run_state
    head_sha = resolved.event.check_suite.head_sha

    parked = next(
        (
            item
            for item in peek_queued_autofix_feedback(run_state.run_id)
            if isinstance(item.feedback.source, CheckSuiteFeedbackSource)
            and item.feedback.source.event.check_suite.head_sha == head_sha
        ),
        None,
    )
    if parked is None:
        return

    if should_defer_pr_iteration(resolved):
        return

    from sentry.tasks.seer.pr_iteration import trigger_consume_pr_iteration_feedback

    trigger_consume_pr_iteration_feedback(
        run_id=run_state.run_id,
        organization_id=resolved.organization.id,
        feedback=parked.feedback,
        run_state=run_state,
        bypass=True,
    )


@scm_event_stream.listen_for(event_type="check_suite")
def pr_iteration_from_check_suite_listener(check_suite_event: CheckSuiteEvent):
    if check_suite_event.action != "completed":
        return None

    conclusion = check_suite_event.check_suite["conclusion"]
    if conclusion in GREEN_CONCLUSIONS:
        resolved = resolve_green_check_suite(check_suite_event)
        if resolved is None:
            return None

        # Peek the queue for parked check-suite feedback on this head, then
        # ``should_defer_pr_iteration`` (GitHub sweep) only if something is
        # waiting. Isolated so a failure cannot swallow undraft / review-request
        # below.
        try:
            _retrigger_deferred_iteration(resolved)
        except Exception:
            logger.warning(
                "autofix.pr_iteration.green_check_suite.retrigger_deferred_consume_failed",
                extra=resolved.log_extra,
                exc_info=True,
            )

        if not green_review_side_effects_enabled(resolved):
            return None

        # Cheap resolve → read markers once → skip SCM if both done → confirm
        # green → run only the missing side effects. Undraft before
        # review-request: GitHub may CODEOWNERS-request after undraft; see TODO
        # on ``request_review_from_context``.
        ready_for_review_marker = get_run_marker(
            resolved.seer_run, READY_FOR_REVIEW_EXTRA, resolved.repo_name
        )
        review_request_marker = get_run_marker(
            resolved.seer_run, REVIEW_REQUESTS_EXTRA, resolved.repo_name
        )
        if ready_for_review_marker is not None and review_request_marker is not None:
            return None
        ctx = confirm_green_check_suite(resolved)
        if ctx is None:
            return None
        if ready_for_review_marker is None:
            mark_ready_for_review(ctx)
        if review_request_marker is None:
            request_review_from_context(ctx)
        return None

    if conclusion not in FAILURE_CONCLUSIONS:
        return None

    try:
        raw = orjson.loads(check_suite_event.subscription_event["event"])
        source = CheckSuiteFeedbackSource(event=raw)
        # Expensive: Seer RPCs (cached on source for should_trigger). PrivateAttr
        # so Django/Seer objects never hit Redis / history JSON.
        autofix_run = source.autofix_run
    except MissingCheckSuiteAutofixRun:
        # Expected for check suites on PRs without an Autofix run.
        return None
    except (orjson.JSONDecodeError, ValidationError, TypeError, ValueError) as e:
        # Malformed webhook payload — report and drop; do not fail the listener task.
        sentry_sdk.capture_exception(e)
        return None

    repo = autofix_run.repository
    organization_id = repo.organization_id
    agent_state = autofix_run.run_state
    feedback = Feedback(source=source)

    enqueued = try_enqueue_autofix_feedback(
        run_id=agent_state.run_id,
        organization_id=organization_id,
        group_id=autofix_run.group_id,
        feedback=feedback,
        referrer=AutofixReferrer.GITHUB_CHECK_SUITE,
        run_state=agent_state,
    )
    if not enqueued:
        # Feedback is rejected for a stale head or for the iteration hard cap.
        # In the cap case the run would otherwise just go quiet, so hand the PR
        # to a human instead (the handler re-checks which case applies).
        assign_user_for_exhausted_cap(source.event, autofix_run)
        return None

    # Defer Now/Later/skip to `should_trigger` (incomplete check runs schedule
    # a delayed consume rather than dropping the scheduled task entirely).
    logger.info(
        "autofix.pr_iteration.check_suite.trigger_consume",
        extra={
            "organization_id": organization_id,
            "repo_id": repo.id,
            "pr_id": autofix_run.pr_id,
            "run_id": agent_state.run_id,
        },
    )
    # Lazy: tasks.seer.pr_iteration → scm.factory → github → jira client
    # which calls absolute_uri() at import time (needs options cache).
    # stream.py is loaded in AppConfig.ready before options init.
    from sentry.tasks.seer.pr_iteration import trigger_consume_pr_iteration_feedback

    trigger_consume_pr_iteration_feedback(
        run_id=agent_state.run_id,
        organization_id=organization_id,
        feedback=feedback,
        run_state=agent_state,
    )
