import logging

import orjson
import sentry_sdk
from pydantic import ValidationError

from sentry.scm.private.event_stream import scm_event_stream
from sentry.scm.types import CheckSuiteEvent
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.cap_exhausted import assign_user_for_exhausted_cap
from sentry.seer.autofix.pr_iteration.check_suites import FAILURE_CONCLUSIONS
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import (
    CheckSuiteFeedbackSource,
    MissingCheckSuiteAutofixRun,
)
from sentry.seer.autofix.pr_iteration.queue import try_enqueue_autofix_feedback
from sentry.seer.autofix.pr_iteration.review_request import (
    GREEN_CONCLUSIONS,
    request_review_for_green_check_suite,
)

logger = logging.getLogger(__name__)


@scm_event_stream.listen_for(event_type="check_suite")
def pr_iteration_from_check_suite_listener(check_suite_event: CheckSuiteEvent):
    if check_suite_event.action != "completed":
        return None

    conclusion = check_suite_event.check_suite["conclusion"]
    if conclusion in GREEN_CONCLUSIONS:
        request_review_for_green_check_suite(check_suite_event)
        return None

    if conclusion not in FAILURE_CONCLUSIONS:
        return None

    try:
        raw = orjson.loads(check_suite_event.subscription_event["event"])
        source = CheckSuiteFeedbackSource(event=raw)
        # Expensive: Seer RPCs (cached on source for should_trigger). PrivateAttr
        # so Django/Seer objects never hit Redis / history JSON.
        resolved = source.autofix_run
    except MissingCheckSuiteAutofixRun:
        # Expected for check suites on PRs without an Autofix run.
        return None
    except (orjson.JSONDecodeError, ValidationError, TypeError, ValueError) as e:
        # Malformed webhook payload — report and drop; do not fail the listener task.
        sentry_sdk.capture_exception(e)
        return None

    repo = resolved.repository
    organization_id = repo.organization_id
    agent_state = resolved.run_state
    feedback = Feedback(source=source)

    enqueued = try_enqueue_autofix_feedback(
        run_id=agent_state.run_id,
        organization_id=organization_id,
        group_id=resolved.group_id,
        feedback=feedback,
        referrer=AutofixReferrer.GITHUB_CHECK_SUITE,
        run_state=agent_state,
    )
    if not enqueued:
        # Feedback is rejected for a stale head or for the iteration hard cap.
        # In the cap case the run would otherwise just go quiet, so hand the PR
        # to a human instead (the handler re-checks which case applies).
        assign_user_for_exhausted_cap(source.event, resolved)
        return None

    # Defer Now/Later/skip to `should_trigger` (incomplete check runs schedule
    # a delayed consume rather than dropping the scheduled task entirely).
    logger.info(
        "autofix.pr_iteration.check_suite.trigger_consume",
        extra={
            "organization_id": organization_id,
            "repo_id": repo.id,
            "pr_id": resolved.pr_id,
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
