"""Sentry-side bookkeeping for :class:`SeerRunCodingAgentHandoff` — the record of a
coding agent Seer handed a run off to (Cursor/GitHub Copilot/Claude Code), and its
outcome.
"""

from __future__ import annotations

import logging
from typing import NamedTuple

from sentry.models.organization import Organization
from sentry.models.pullrequest import parse_pull_request_number
from sentry.seer.autofix.constants import CodingAgentStatus
from sentry.seer.autofix.utils import (
    CodingAgentProviderType,
    CodingAgentResult,
    CodingAgentState,
    update_coding_agent_state,
)
from sentry.seer.endpoints.utils import get_seer_run
from sentry.seer.models.run import (
    SeerAgentRun,
    SeerRunCodingAgentHandoff,
    SeerRunCodingAgentHandoffExtras,
)
from sentry.seer.pull_requests import link_pull_request_to_seer_run

logger = logging.getLogger(__name__)


class CodingAgentSyncResult(NamedTuple):
    """Result of :func:`sync_coding_agent_status`.

    ``run_id``/``group_id`` are resolved locally from the handoff's ``seer_run``
    (and its ``SeerAgentRun`` sibling, populated when the run was launched
    against an issue) — no Seer round trip needed. Both are ``None`` when no
    matching handoff row exists locally.

    Being a tuple, this is always truthy — check ``.known_to_seer`` explicitly
    rather than the result object itself.
    """

    known_to_seer: bool
    run_id: int | None
    group_id: int | None


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


def sync_coding_agent_status(
    *,
    agent_id: str,
    organization_id: int,
    status: CodingAgentStatus,
    agent_url: str | None = None,
    result: CodingAgentResult | None = None,
) -> CodingAgentSyncResult:
    """Update Sentry's own SeerRunCodingAgentHandoff, then Seer's coding agent state,
    and link the resulting PR (if any) to the handoff's run via SeerRunPullRequest.

    ``known_to_seer`` mirrors ``update_coding_agent_state``'s return value (e.g.
    for gating PR attribution). ``run_id``/``group_id`` are populated whenever a
    matching handoff row exists locally.
    """
    log_context = {"agent_id": agent_id, "organization_id": organization_id}

    run_id: int | None = None
    group_id: int | None = None

    try:
        handoff = SeerRunCodingAgentHandoff.objects.select_related("seer_run__agent").get(
            agent_id=agent_id, seer_run__organization_id=organization_id
        )
    except SeerRunCodingAgentHandoff.DoesNotExist:
        handoff = None
        logger.info("seer.coding_agent_handoff.not_found", extra=log_context)

    if handoff is not None:
        run_id = handoff.seer_run.seer_run_state_id
        try:
            group_id = handoff.seer_run.agent.group_id
        except SeerAgentRun.DoesNotExist:
            group_id = None

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
                return CodingAgentSyncResult(known_to_seer=False, run_id=run_id, group_id=group_id)

        if result and result.pr_url:
            pr_number = parse_pull_request_number(result.pr_url)
            link_log_context = {
                **log_context,
                "repo_name": result.repo_full_name,
                "provider": result.repo_provider,
                "pr_number": pr_number,
            }

            link_pull_request_to_seer_run(
                organization=handoff.seer_run.organization,
                seer_run=handoff.seer_run,
                repo_name=result.repo_full_name,
                provider=result.repo_provider,
                pr_number=pr_number,
                log_context=link_log_context,
                coding_agent_handoff=handoff,
            )

    known_to_seer = update_coding_agent_state(
        agent_id=agent_id, status=status, agent_url=agent_url, result=result
    )

    return CodingAgentSyncResult(known_to_seer=known_to_seer, run_id=run_id, group_id=group_id)
