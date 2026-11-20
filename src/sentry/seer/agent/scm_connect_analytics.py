"""Analytics for the popup that asks a Seer chat's owner to fix access to a repository.

Seer doesn't report the popup, so Sentry records it from its own endpoints: `shown` when the
chat's state first reaches its owner paused on the popup, and `resolved` when the owner answers it
or sends a new message. A cache note per run links the two, so a `shown` with no `resolved` is a
popup the owner left. Recording never fails the request.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from sentry import analytics
from sentry.analytics.events.seer_scm_connect_events import (
    SeerScmConnectResolvedEvent,
    SeerScmConnectShownEvent,
)
from sentry.models.organization import Organization
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.agent.tools import get_repository_definition
from sentry.seer.sentry_data_models import RepositoryDefinitionFailure
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)

NOTE_TTL = 7 * 24 * 60 * 60


def _note_key(organization_id: int, run_id: int) -> str:
    return f"seer:scm-connect:{organization_id}:{run_id}"


def record_scm_connect_shown(
    organization: Organization,
    user_id: int | None,
    run_id: int,
    state: SeerRunState,
    *,
    can_install_integrations: bool,
) -> None:
    pending = state.pending_user_input
    if pending is None or pending.input_type != "connect_scm":
        return
    # Anyone else viewing the chat can't answer the popup.
    if state.owner_user_id is not None and state.owner_user_id != user_id:
        return
    try:
        key = _note_key(organization.id, run_id)
        note = cache.get(key)
        # The state is fetched every few seconds, so only its first fetch counts.
        if note is not None and note["input_id"] == pending.id:
            return
        note = {
            "input_id": pending.id,
            "repo_name": str(pending.data.get("repo_name", "")),
            "failure_reason": str(pending.data.get("failure_reason", "")),
            "shown_at": time.time(),
            "resolved": False,
        }
        cache.set(key, note, timeout=NOTE_TTL)
        analytics.record(
            SeerScmConnectShownEvent(
                organization_id=organization.id,
                user_id=user_id,
                run_id=run_id,
                input_id=pending.id,
                failure_reason=note["failure_reason"],
                can_install_integrations=can_install_integrations,
            )
        )
    except Exception:
        logger.exception("seer.scm_connect.shown.record_failed", extra={"run_id": run_id})


def record_scm_connect_answered(
    organization: Organization, user_id: int | None, run_id: int, payload: dict[str, Any]
) -> None:
    """For a `user_input_response` Seer accepted. Other user inputs never match the popup's id."""
    response_data = payload.get("response_data")
    if not isinstance(response_data, dict):
        return
    _record_resolved(
        organization,
        user_id,
        run_id,
        str(response_data.get("decision")),
        input_id=payload.get("input_id"),
        repo_name=response_data.get("repo_name"),
    )


def record_scm_connect_new_message(
    organization: Organization, user_id: int | None, run_id: int
) -> None:
    """For a new message Seer accepted, which closes any popup still open."""
    _record_resolved(organization, user_id, run_id, "new_message")


def _record_resolved(
    organization: Organization,
    user_id: int | None,
    run_id: int,
    resolution: str,
    *,
    input_id: str | None = None,
    repo_name: str | None = None,
) -> None:
    try:
        key = _note_key(organization.id, run_id)
        note = cache.get(key)
        if note is None or note["resolved"]:
            return
        if input_id is not None and input_id != note["input_id"]:
            return

        # The same check the popup polls. A corrected name is checked instead of the original.
        result = get_repository_definition(
            organization_id=organization.id,
            repo_full_name=repo_name or note["repo_name"],
            report_failure_reason=True,
        )
        repo_status: str
        if isinstance(result, RepositoryDefinitionFailure):
            repo_status = result.failure_reason
        else:
            repo_status = "unknown" if result is None else "found"

        analytics.record(
            SeerScmConnectResolvedEvent(
                organization_id=organization.id,
                user_id=user_id,
                run_id=run_id,
                input_id=note["input_id"],
                failure_reason=note["failure_reason"],
                resolution=resolution,
                repo_status=repo_status,
                seconds_open=int(time.time() - note["shown_at"]),
            )
        )
        cache.set(key, {**note, "resolved": True}, timeout=NOTE_TTL)
    except Exception:
        logger.exception("seer.scm_connect.resolved.record_failed", extra={"run_id": run_id})
