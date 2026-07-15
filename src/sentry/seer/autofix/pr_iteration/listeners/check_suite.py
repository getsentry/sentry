import logging

import orjson
import sentry_sdk
from pydantic import ValidationError

from sentry.scm.private.event_stream import scm_event_stream
from sentry.scm.types import CheckSuiteEvent
from sentry.seer.agent.client_utils import get_agent_state_from_pr_id
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.queue import try_enqueue_autofix_feedback
from sentry.seer.models import SeerApiError

logger = logging.getLogger(__name__)

CONCLUSIONS = ["failure", "timed_out", "action_required", "startup_failure"]
_SEER_GITHUB_PROVIDER = "integrations:github"


@scm_event_stream.listen_for(event_type="check_suite")
def pr_iteration_from_check_suite_listener(check_suite_event: CheckSuiteEvent):
    if check_suite_event.action != "completed":
        return None

    if check_suite_event.check_suite["conclusion"] not in CONCLUSIONS:
        return None

    try:
        raw = orjson.loads(check_suite_event.subscription_event["event"])
        source = CheckSuiteFeedbackSource(event=raw)
    except (orjson.JSONDecodeError, ValidationError, TypeError, ValueError) as e:
        # Malformed webhook payload — report and drop; do not fail the listener task.
        sentry_sdk.capture_exception(e)
        return None

    event = source.event
    repo = source.repository
    if repo is None:
        return None

    organization_id = repo.organization_id
    check_suite = event.check_suite
    pr_ids = [pr.id for pr in check_suite.pull_requests]
    if not pr_ids:
        return None

    for pr_id in pr_ids:
        try:
            agent_state = get_agent_state_from_pr_id(organization_id, _SEER_GITHUB_PROVIDER, pr_id)
        except SeerApiError as e:
            # One PR's Seer failure must not abort the rest of the suite.
            sentry_sdk.capture_exception(e)
            continue

        if agent_state is None or not agent_state.repo_pr_states:
            continue

        group_id = agent_state.metadata.get("group_id") if agent_state.metadata else None
        if not group_id:
            logger.warning(
                "autofix.pr_iteration.check_suite.missing_group_id",
                extra={
                    "organization_id": organization_id,
                    "pr_id": pr_id,
                    "run_id": agent_state.run_id,
                },
            )
            continue

        # `source.text` / `source.ui_text` are derived from the check-suite event.
        feedback = Feedback(source=source)

        enqueued = try_enqueue_autofix_feedback(
            run_id=agent_state.run_id,
            organization_id=organization_id,
            group_id=group_id,
            feedback=feedback,
            referrer=AutofixReferrer.GITHUB_CHECK_SUITE,
            run_state=agent_state,
        )
        if not enqueued:
            continue

        # Defer Now/Later/skip to `should_trigger` (incomplete check runs schedule
        # a delayed consume rather than dropping the scheduled task entirely).
        logger.info(
            "autofix.pr_iteration.check_suite.trigger_consume",
            extra={
                "organization_id": organization_id,
                "repo_id": repo.id,
                "pr_id": pr_id,
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
