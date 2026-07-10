"""Sentry-side bookkeeping for :class:`SeerRunCodingAgentHandoff` — the record of a
coding agent Seer handed a run off to (Cursor/GitHub Copilot/Claude Code), and its
outcome.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence

from sentry.models.organization import Organization
from sentry.models.pullrequest import parse_pull_request_number
from sentry.seer.autofix.utils import (
    CodingAgentResult,
    CodingAgentState,
    CodingAgentStatus,
    update_coding_agent_state,
)
from sentry.seer.endpoints.utils import get_seer_run
from sentry.seer.models.run import SeerRunCodingAgentHandoff
from sentry.seer.pull_requests import _link_pull_request_to_seer_run

logger = logging.getLogger(__name__)


def create_seer_run_coding_agent_handoffs(
    organization: Organization,
    run_id: int,
    states: Sequence[CodingAgentState],
) -> None:
    """Record the coding agents launched for ``run_id``. Best-effort: any failure
    is logged and swallowed rather than allowed to interrupt the launch flow.
    """
    if not states:
        return

    log_context = {"organization_id": organization.id, "run_id": run_id}

    try:
        seer_run = get_seer_run(run_id, organization)
        if seer_run is None:
            logger.info("seer.coding_agent_handoff.run_not_found", extra=log_context)
            return

        SeerRunCodingAgentHandoff.objects.bulk_create(
            [
                SeerRunCodingAgentHandoff(
                    seer_run=seer_run,
                    provider=state.provider.value,
                    agent_id=state.id,
                    agent_url=state.agent_url,
                    status=state.status.value,
                )
                for state in states
            ]
        )
    except Exception:
        logger.exception("seer.coding_agent_handoff.create_failed", extra=log_context)


def sync_coding_agent_status(
    *,
    agent_id: str,
    organization_id: int,
    status: CodingAgentStatus,
    agent_url: str | None = None,
    result: CodingAgentResult | None = None,
) -> bool:
    """Update both Seer's coding agent state and Sentry's own
    :class:`SeerRunCodingAgentHandoff` tracking row, in lockstep -- a single call so
    the two can never drift out of sync the way two separately-called functions can.

    Also links the resulting PR (if any) to the handoff's run via
    :class:`SeerRunPullRequest`. Best-effort: any failure updating the Sentry-side
    row is logged and swallowed rather than allowed to interrupt the caller's
    poll/webhook flow.

    Returns whether Seer recognized this ``agent_id`` (mirrors
    ``update_coding_agent_state``'s return value, e.g. for gating PR attribution).
    """
    known_to_seer = update_coding_agent_state(
        agent_id=agent_id, status=status, agent_url=agent_url, result=result
    )

    log_context = {"agent_id": agent_id, "organization_id": organization_id}

    try:
        handoff = SeerRunCodingAgentHandoff.objects.select_related("seer_run").get(
            agent_id=agent_id
        )
    except SeerRunCodingAgentHandoff.DoesNotExist:
        logger.info("seer.coding_agent_handoff.not_found", extra=log_context)
        return known_to_seer

    # agent_id is a bare, globally-unique lookup key — guard against acting on a
    # handoff from a different org (e.g. a caller passing the wrong organization_id).
    if handoff.seer_run.organization_id != organization_id:
        logger.warning("seer.coding_agent_handoff.org_mismatch", extra=log_context)
        return known_to_seer

    try:
        handoff.status = status.value
        update_fields = ["status", "date_updated"]
        if agent_url is not None:
            handoff.agent_url = agent_url
            update_fields.append("agent_url")
        handoff.save(update_fields=update_fields)
    except Exception:
        logger.exception("seer.coding_agent_handoff.update_failed", extra=log_context)
        return known_to_seer

    if not result or not result.pr_url:
        return known_to_seer

    pr_number = parse_pull_request_number(result.pr_url)
    link_log_context = {
        **log_context,
        "repo_name": result.repo_full_name,
        "provider": result.repo_provider,
        "pr_number": pr_number,
    }

    pull_request = _link_pull_request_to_seer_run(
        organization=handoff.seer_run.organization,
        seer_run=handoff.seer_run,
        repo_name=result.repo_full_name,
        provider=result.repo_provider,
        pr_number=pr_number,
        log_context=link_log_context,
    )
    if pull_request is not None:
        try:
            handoff.pull_request = pull_request
            handoff.save(update_fields=["pull_request", "date_updated"])
        except Exception:
            logger.exception(
                "seer.coding_agent_handoff.pr_link_save_failed", extra=link_log_context
            )

    return known_to_seer
