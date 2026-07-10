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
    CodingAgentProviderType,
    CodingAgentResult,
    CodingAgentState,
    CodingAgentStatus,
    update_coding_agent_state,
)
from sentry.seer.endpoints.utils import get_seer_run
from sentry.seer.models.run import (
    SeerRunCodingAgentHandoff,
    SeerRunCodingAgentHandoffExtras,
    SeerRunCodingAgentHandoffStatus,
)
from sentry.seer.pull_requests import _link_pull_request_to_seer_run

logger = logging.getLogger(__name__)


def create_seer_run_coding_agent_handoff(
    organization: Organization,
    run_id: int,
    state: CodingAgentState,
) -> None:
    log_context = {"organization_id": organization.id, "run_id": run_id}

    try:
        seer_run = get_seer_run(run_id, organization)
        if seer_run is None:
            logger.info("seer.coding_agent_handoff.run_not_found", extra=log_context)
            return

        extras: SeerRunCodingAgentHandoffExtras = {"agent_url": state.agent_url}
        SeerRunCodingAgentHandoff.objects.create(
            seer_run=seer_run,
            provider=state.provider.value,
            agent_id=state.id,
            status=state.status.value,
            extras=extras,
        )
    except Exception:
        logger.exception("seer.coding_agent_handoff.create_failed", extra=log_context)


def mark_seer_run_coding_agent_handoffs_failed(agent_ids: Sequence[str]) -> None:
    """Mark handoffs failed when Seer was never told about them at all. GitHub
    Copilot/Claude Code polls only discover an agent by iterating Seer's own copy
    of it, so if that registration never happened, nothing will ever check on it
    again -- leaving the row at its initial pending/running status would make it
    look like it's still in progress forever. (A Cursor row marked failed here
    still gets corrected by its own webhook later, since that path doesn't depend
    on Seer's registration.)
    """
    if not agent_ids:
        return

    try:
        SeerRunCodingAgentHandoff.objects.filter(agent_id__in=agent_ids).update(
            status=SeerRunCodingAgentHandoffStatus.FAILED
        )
    except Exception:
        logger.exception(
            "seer.coding_agent_handoff.mark_failed_error", extra={"agent_ids": agent_ids}
        )


def sync_coding_agent_status(
    *,
    agent_id: str,
    organization_id: int,
    status: CodingAgentStatus,
    agent_url: str | None = None,
    result: CodingAgentResult | None = None,
) -> bool:
    """Update Sentry's own SeerRunCodingAgentHandoff, then Seer's coding agent state,
    and link the resulting PR (if any) to the handoff's run via SeerRunPullRequest.

    Returns whether Seer recognized this ``agent_id`` (mirrors
    ``update_coding_agent_state``'s return value, e.g. for gating PR attribution).
    """
    log_context = {"agent_id": agent_id, "organization_id": organization_id}

    try:
        handoff = SeerRunCodingAgentHandoff.objects.select_related("seer_run").get(
            agent_id=agent_id, seer_run__organization_id=organization_id
        )
    except SeerRunCodingAgentHandoff.DoesNotExist:
        handoff = None
        logger.info("seer.coding_agent_handoff.not_found", extra=log_context)

    if handoff is not None:
        try:
            handoff.status = status.value
            update_fields = ["status", "date_updated"]
            if agent_url is not None:
                extras: SeerRunCodingAgentHandoffExtras = {
                    **handoff.extras,
                    "agent_url": agent_url,
                }
                handoff.extras = extras
                update_fields.append("extras")
            handoff.save(update_fields=update_fields)
        except Exception:
            logger.exception("seer.coding_agent_handoff.update_failed", extra=log_context)
            if handoff.provider != CodingAgentProviderType.CURSOR_BACKGROUND_AGENT.value:
                return False

    known_to_seer = update_coding_agent_state(
        agent_id=agent_id, status=status, agent_url=agent_url, result=result
    )

    if handoff is None or not result or not result.pr_url:
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
