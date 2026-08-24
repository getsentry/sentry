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
    confirm_green_check_suite,
    resolve_check_suite_flag_gate,
    resolve_green_check_suite,
)
from sentry.seer.autofix.pr_iteration.constants import (
    FAILING_CHECK_SUITE_FLAGS,
    GREEN_CHECK_SUITE_FLAGS,
)
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import (
    CheckSuiteFeedbackSource,
    MissingCheckSuiteAutofixRun,
)
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.seer.autofix.pr_iteration.queue import try_enqueue_autofix_feedback
from sentry.seer.autofix.pr_iteration.ready_for_review import mark_ready_for_review
from sentry.seer.autofix.pr_iteration.review_request import request_review_from_context
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker

logger = logging.getLogger(__name__)


@scm_event_stream.listen_for(event_type="check_suite")
def pr_iteration_from_check_suite_listener(check_suite_event: CheckSuiteEvent):
    if check_suite_event.action != "completed":
        return None

    conclusion = check_suite_event.check_suite["conclusion"]
    is_green = conclusion in GREEN_CONCLUSIONS

    if not is_green and conclusion not in FAILURE_CONCLUSIONS:
        return None

    # Drop suites nobody behind the installation can act on
    gate_flags = GREEN_CHECK_SUITE_FLAGS if is_green else FAILING_CHECK_SUITE_FLAGS
    if not resolve_check_suite_flag_gate(check_suite_event, gate_flags).flagged_organization_ids:
        return None

    if is_green:
        # Cheap resolve → read markers once → skip SCM if both done → confirm
        # green → run only the missing side effects. Undraft before
        # review-request: GitHub may CODEOWNERS-request after undraft; see TODO
        # on ``request_review_from_context``.
        resolved = resolve_green_check_suite(check_suite_event)
        if resolved is None:
            return None
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
        # Nothing parsed, so there is no source to describe the suite: fall back to
        # what the SCM stream attached before anyone touched the body.
        sentry_sdk.capture_exception(e)
        stream_extra = check_suite_event.subscription_event.get("extra") or {}
        logger.error(
            "autofix.pr_iteration.check_suite.unparseable_payload",
            extra={
                "installation_id": stream_extra.get("installation_id"),
                "repository_id": stream_extra.get("repository_id"),
                "check_suite_id": check_suite_event.check_suite["id"],
                "check_suite_conclusion": conclusion,
            },
            exc_info=True,
        )
        return None

    organization_id = autofix_run.repository.organization_id
    agent_state = autofix_run.run_state
    feedback = Feedback(source=source)
    # One identity for both decisions below, so the queue line and the trigger
    # line of a single check suite are found by the same search.
    log_ctx = PrIterationLogContext.for_run(
        logger, agent_state, organization_id, autofix_run.group_id
    )

    # report failrues here rather than in the SCM event stream error monitoring
    # so it's easier to find errors in Sentry in the PR iteration flow
    try:
        enqueued = try_enqueue_autofix_feedback(
            log_ctx=log_ctx,
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
        # a delayed consume rather than dropping the scheduled task entirely). It logs
        # `autofix.pr_iteration.feedback.trigger` either way.
        #
        # Lazy: tasks.seer.pr_iteration → scm.factory → github → jira client
        # which calls absolute_uri() at import time (needs options cache).
        # stream.py is loaded in AppConfig.ready before options init.
        from sentry.tasks.seer.pr_iteration import trigger_consume_pr_iteration_feedback

        trigger_consume_pr_iteration_feedback(
            log_ctx=log_ctx,
            run_id=agent_state.run_id,
            organization_id=organization_id,
            feedback=feedback,
            run_state=agent_state,
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)
        log_ctx.error(
            "autofix.pr_iteration.check_suite.failed",
            error_type=type(e).__name__,
            **source.log_fields(agent_state),
        )
        return None
