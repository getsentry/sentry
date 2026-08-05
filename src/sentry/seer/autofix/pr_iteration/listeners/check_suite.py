import logging

from sentry.scm.private.event_stream import scm_event_stream
from sentry.scm.types import CheckSuiteEvent
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.cap_exhausted import assign_user_for_exhausted_cap
from sentry.seer.autofix.pr_iteration.check_suites import (
    CHECK_SUITE_CONCLUSION_TYPES,
    READY_FOR_REVIEW_EXTRA,
    REVIEW_REQUESTS_EXTRA,
    CheckSuiteConclusionType,
    ResolvedCheckSuite,
    confirm_green_check_suite,
    ready_for_green_check_suite_side_effects,
    resolve_check_suite,
)
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import (
    CheckSuiteFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.queue import try_enqueue_autofix_feedback
from sentry.seer.autofix.pr_iteration.ready_for_review import mark_ready_for_review
from sentry.seer.autofix.pr_iteration.review_request import request_review_from_context
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker

logger = logging.getLogger(__name__)


def _resolve_autofix_check_suite(
    check_suite_event: CheckSuiteEvent,
) -> tuple[CheckSuiteConclusionType, ResolvedCheckSuite] | None:
    """Parse + resolve when this completed suite is green or red.

    Single call site for ``resolve_check_suite``. Green gates (review-request
    flag, ``SeerRun``, PR number) are checked after resolve.
    """
    if check_suite_event.action != "completed":
        return None

    conclusion_type = CHECK_SUITE_CONCLUSION_TYPES.get(check_suite_event.check_suite["conclusion"])
    if conclusion_type is None:
        return None

    resolved = resolve_check_suite(check_suite_event)
    if resolved is None:
        return None
    if (
        conclusion_type is CheckSuiteConclusionType.GREEN
        and not ready_for_green_check_suite_side_effects(resolved)
    ):
        return None
    return conclusion_type, resolved


def _is_relevant_autofix_check_suite(check_suite_event: CheckSuiteEvent) -> bool:
    """Cheap gate: completed green/red suite tied to an Autofix PR that still needs work.

    Runs inside the 10s SCM listener. Returns True only when a longer-deadline
    task should pick up the meat (sweep / undraft / iterate).
    """
    resolved_suite = _resolve_autofix_check_suite(check_suite_event)
    if resolved_suite is None:
        return False

    conclusion_type, resolved = resolved_suite
    if conclusion_type is CheckSuiteConclusionType.RED:
        return True

    # Green: skip when both sticky side-effect markers are already set.
    ready_for_review_marker = get_run_marker(
        resolved.seer_run, READY_FOR_REVIEW_EXTRA, resolved.repo_name
    )
    review_request_marker = get_run_marker(
        resolved.seer_run, REVIEW_REQUESTS_EXTRA, resolved.repo_name
    )
    return ready_for_review_marker is None or review_request_marker is None


def handle_pr_iteration_check_suite(check_suite_event: CheckSuiteEvent) -> None:
    """Meat of check-suite handling: green undraft/review or red→iterate.

    Intended to run on a longer-deadline task after
    ``_is_relevant_autofix_check_suite`` has already gated relevance.
    """
    resolved_suite = _resolve_autofix_check_suite(check_suite_event)
    if resolved_suite is None:
        return None

    conclusion_type, resolved = resolved_suite
    if conclusion_type is CheckSuiteConclusionType.RED:
        autofix_run = resolved.autofix_run
        # Reuse the resolve result so we don't hit Seer again for the same PR.
        source = CheckSuiteFeedbackSource(event=resolved.event)
        source._autofix_run = autofix_run

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
        return None

    # Green: read markers once → skip SCM if both done → confirm green → run
    # only the missing side effects. Undraft before review-request: GitHub may
    # CODEOWNERS-request after undraft; see TODO on ``request_review_from_context``.
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


@scm_event_stream.listen_for(event_type="check_suite")
def pr_iteration_from_check_suite_listener(check_suite_event: CheckSuiteEvent):
    """SCM stream entry (10s deadline): relevance guard, then queue the meat."""
    if not _is_relevant_autofix_check_suite(check_suite_event):
        return None

    # Lazy: tasks.seer.pr_iteration pulls SCM/GitHub clients that need options.
    from sentry.tasks.seer.pr_iteration import process_pr_iteration_check_suite

    process_pr_iteration_check_suite.delay(
        subscription_event=dict(check_suite_event.subscription_event),
    )
    return None
