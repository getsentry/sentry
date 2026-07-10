"""Sentry-side bookkeeping for :class:`SeerRunCodingAgentHandoff` — the record of a
coding agent Seer handed a run off to (Cursor/GitHub Copilot/Claude Code), and its
outcome.
"""

from __future__ import annotations

import logging

from sentry.models.organization import Organization
from sentry.seer.autofix.utils import (
    CodingAgentResult,
    CodingAgentState,
    CodingAgentStatus,
    update_coding_agent_state,
)
from sentry.seer.endpoints.utils import get_seer_run
from sentry.seer.models.run import SeerRunCodingAgentHandoff

logger = logging.getLogger(__name__)


def create_seer_run_coding_agent_handoff(
    organization: Organization,
    run_id: int,
    state: CodingAgentState,
) -> None:
    """Record the coding agent just launched for ``run_id``. Best-effort: any
    failure is logged and swallowed rather than allowed to interrupt the launch flow.
    """
    log_context = {"organization_id": organization.id, "run_id": run_id}

    try:
        seer_run = get_seer_run(run_id, organization)
        if seer_run is None:
            logger.info("seer.coding_agent_handoff.run_not_found", extra=log_context)
            return

        SeerRunCodingAgentHandoff.objects.create(
            seer_run=seer_run,
            provider=state.provider.value,
            agent_id=state.id,
            agent_url=state.agent_url,
            status=state.status.value,
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

    Best-effort: any failure updating the Sentry-side row is logged and swallowed
    rather than allowed to interrupt the caller's poll/webhook flow.

    Returns whether Seer recognized this ``agent_id`` (mirrors
    ``update_coding_agent_state``'s return value, e.g. for gating PR attribution).
    """
    known_to_seer = update_coding_agent_state(
        agent_id=agent_id, status=status, agent_url=agent_url, result=result
    )

    log_context = {"agent_id": agent_id, "organization_id": organization_id}

    try:
        handoff = SeerRunCodingAgentHandoff.objects.select_related("seer_run").get(
            agent_id=agent_id, seer_run__organization_id=organization_id
        )
    except SeerRunCodingAgentHandoff.DoesNotExist:
        logger.info("seer.coding_agent_handoff.not_found", extra=log_context)
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
