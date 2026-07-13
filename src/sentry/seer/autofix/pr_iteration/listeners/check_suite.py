import logging

import orjson
from scm import actions as scm_actions
from scm.types import ListCheckRunsForRefProtocol

from sentry.scm.factory import new as make_scm
from sentry.scm.private.event_stream import scm_event_stream
from sentry.scm.types import CheckSuiteEvent
from sentry.seer.agent.client_utils import get_agent_state_from_pr_id
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.queue import try_enqueue_autofix_feedback
from sentry.tasks.seer.pr_iteration import trigger_consume_pr_iteration_feedback

logger = logging.getLogger(__name__)

CONCLUSIONS = ["failure", "timed_out", "action_required", "startup_failure"]
_SEER_GITHUB_PROVIDER = "integrations:github"


@scm_event_stream.listen_for(event_type="check_suite")
def pr_iteration_from_check_suite_listener(check_suite_event: CheckSuiteEvent):
    if check_suite_event.action != "completed":
        return None

    if check_suite_event.check_suite["conclusion"] not in CONCLUSIONS:
        return None

    raw = orjson.loads(check_suite_event.subscription_event["event"])

    source = CheckSuiteFeedbackSource(event=raw)
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
        agent_state = get_agent_state_from_pr_id(organization_id, _SEER_GITHUB_PROVIDER, pr_id)
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

        # Only consume once every check run on the head commit has finished.
        # We gate on check *runs* rather than check *suites*: apps often register
        # a check suite on the PR that never runs anything (it sits `queued`
        # forever), so an "all suites completed" gate would never fire.
        head_sha = check_suite.head_sha
        try:
            scm = make_scm(organization_id, repo.id, referrer="seer")
        except Exception:
            logger.warning(
                "autofix.pr_iteration.check_suite.scm_init_failed",
                extra={
                    "organization_id": organization_id,
                    "repo_id": repo.id,
                    "pr_id": pr_id,
                    "run_id": agent_state.run_id,
                    "head_sha": head_sha,
                },
                exc_info=True,
            )
            scm = None
        if isinstance(scm, ListCheckRunsForRefProtocol) and head_sha:
            check_runs = scm_actions.list_check_runs_for_ref(scm, head_sha)["data"]
            incomplete_count = sum(1 for run in check_runs if run["status"] != "completed")
            if incomplete_count:
                continue

        logger.info(
            "autofix.pr_iteration.check_suite.trigger_consume",
            extra={
                "organization_id": organization_id,
                "repo_id": repo.id,
                "pr_id": pr_id,
                "run_id": agent_state.run_id,
            },
        )
        trigger_consume_pr_iteration_feedback(
            run_id=agent_state.run_id,
            organization_id=organization_id,
            feedback=feedback,
            run_state=agent_state,
        )
