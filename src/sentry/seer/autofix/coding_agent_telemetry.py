"""Normalized telemetry for coding-agent handoff business outcomes.

The regular Sentry backend SDK reports to the backend project. These spans use a
small, isolated SDK client so they land alongside Claude Managed Agents' OTel spans
and can be correlated with them through ``anthropic.session.id``.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from functools import lru_cache
from typing import Any

import sentry_sdk
from django.conf import settings
from django.db import router, transaction
from sentry_sdk import Scope

import sentry
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.repository import Repository
from sentry.seer.autofix.utils import CodingAgentProviderType, CodingAgentResult
from sentry.seer.models.run import (
    SeerAgentRun,
    SeerRunCodingAgentHandoff,
    SeerRunCodingAgentHandoffExtras,
    SeerRunPullRequest,
)

logger = logging.getLogger(__name__)

_SPAN_NAME = "Seer coding agent handoff lifecycle"
_SPAN_OP = "seer.coding_agent_handoff"


@lru_cache(maxsize=4)
def _get_client(dsn: str) -> sentry_sdk.Client:
    return sentry_sdk.Client(
        dsn=dsn,
        default_integrations=False,
        auto_enabling_integrations=False,
        send_default_pii=False,
        traces_sample_rate=1.0,
        trace_lifecycle="stream",
        release=sentry.__semantic_version__,
        environment=getattr(settings, "ENVIRONMENT", None),
    )


def _capture_span(attributes: dict[str, str | int | float | bool]) -> None:
    dsn = settings.SEER_CODING_AGENT_TELEMETRY_DSN
    if not dsn:
        return

    # A fresh Scope deliberately prevents the active backend request trace, tags,
    # user, and client from leaking into this separate telemetry project.
    scope = Scope(client=_get_client(dsn))
    with scope.start_streamed_span(
        name=_SPAN_NAME,
        attributes={"sentry.op": _SPAN_OP, **attributes},
        parent_span=None,
        active=False,
    ):
        pass


def _group_id(handoff: SeerRunCodingAgentHandoff) -> int | None:
    try:
        return handoff.seer_run.agent.group_id
    except SeerAgentRun.DoesNotExist:
        return None


def _result_type(result: CodingAgentResult | None) -> str:
    if result is not None and result.pr_number is not None and result.pr_url:
        return "pull_request"
    if result is not None and result.branch_name is not None and result.pr_url:
        return "branch"
    return "none"


def record_handoff_event(
    *,
    event: str,
    handoff: SeerRunCodingAgentHandoff,
    result: CodingAgentResult | None = None,
    pull_request: PullRequest | None = None,
    pr_url: str | None = None,
) -> None:
    """Emit one best-effort lifecycle span for a persisted handoff."""
    try:
        attributes: dict[str, str | int | float | bool] = {
            "seer.handoff.id": handoff.id,
            "seer.handoff.event": event,
            "seer.coding_agent.id": handoff.agent_id,
            "seer.coding_agent.provider": handoff.provider,
            "seer.coding_agent.status": handoff.status,
            "seer.coding_agent.result_type": (
                "pull_request" if pull_request is not None else _result_type(result)
            ),
            "organization_id": handoff.seer_run.organization_id,
        }
        if handoff.provider == CodingAgentProviderType.CLAUDE_CODE_AGENT.value:
            attributes["anthropic.session.id"] = handoff.agent_id
        if handoff.seer_run.seer_run_state_id is not None:
            attributes["run_id"] = handoff.seer_run.seer_run_state_id
        if (group_id := _group_id(handoff)) is not None:
            attributes["group_id"] = group_id

        extras = handoff.extras
        if repository := extras.get("repository"):
            attributes["seer.repository.full_name"] = repository
        if "auto_create_pr" in extras:
            attributes["seer.handoff.auto_create_pr"] = extras["auto_create_pr"]
        if agent_name := extras.get("agent_name"):
            attributes["seer.coding_agent.name"] = agent_name

        if result is not None:
            attributes["seer.repository.provider"] = result.repo_provider
            attributes["seer.repository.full_name"] = result.repo_full_name
            if result.pr_number is not None and result.pr_url:
                attributes["seer.pr.url"] = result.pr_url
                attributes["seer.pr.number"] = result.pr_number
            elif result.branch_name is not None and result.pr_url:
                attributes["seer.branch.url"] = result.pr_url
                attributes["seer.branch.name"] = result.branch_name

        if pull_request is not None:
            attributes["seer.pr.number"] = (
                int(pull_request.key) if pull_request.key.isdigit() else pull_request.key
            )
            attributes["seer.pr.state"] = pull_request.state or PullRequestLifecycleState.OPEN
            try:
                attributes["seer.repository.full_name"] = Repository.objects.get(
                    id=pull_request.repository_id
                ).name
            except Repository.DoesNotExist:
                pass
            if pr_url is None:
                pr_url = pull_request.get_external_url()
            if pr_url:
                attributes["seer.pr.url"] = pr_url
            if event == "pr_created":
                elapsed = (pull_request.opened_at or pull_request.date_added) - handoff.date_added
                attributes["seer.time_to_pr_ms"] = max(elapsed.total_seconds() * 1000, 0)

        _capture_span(attributes)
    except Exception:
        logger.exception(
            "seer.coding_agent_handoff.telemetry_failed",
            extra={"handoff_id": handoff.id, "event": event},
        )


def _claim_pr_lifecycle_event(handoff_id: int, event_key: str) -> bool:
    with transaction.atomic(using=router.db_for_write(SeerRunCodingAgentHandoff)):
        handoff = SeerRunCodingAgentHandoff.objects.select_for_update().get(id=handoff_id)
        extras: SeerRunCodingAgentHandoffExtras = dict(handoff.extras)
        emitted = list(extras.get("telemetry_events", []))
        if event_key in emitted:
            return False
        emitted.append(event_key)
        extras["telemetry_events"] = emitted
        handoff.extras = extras
        handoff.save(update_fields=["extras", "date_updated"])
        return True


def record_pr_lifecycle_from_github_webhook(
    *,
    github_event: Any,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    **kwargs: Any,
) -> None:
    """Emit a terminal PR event after attribution/linking has run for the webhook."""
    pull_request_payload = event.get("pull_request")
    if event.get("action") != "closed" or not pull_request_payload:
        return

    try:
        pull_request = PullRequest.objects.get(
            organization_id=organization.id,
            repository_id=repo.id,
            key=str(pull_request_payload["number"]),
        )
    except PullRequest.DoesNotExist:
        return

    lifecycle_event = "pr_merged" if pull_request_payload.get("merged") else "pr_closed"
    links = SeerRunPullRequest.objects.select_related(
        "coding_agent_handoff__seer_run__agent", "pull_request"
    ).filter(pull_request=pull_request, coding_agent_handoff__isnull=False)
    for link in links:
        handoff = link.coding_agent_handoff
        if handoff is None:
            continue
        event_key = f"{lifecycle_event}:{pull_request.id}"
        if _claim_pr_lifecycle_event(handoff.id, event_key):
            record_handoff_event(
                event=lifecycle_event,
                handoff=handoff,
                pull_request=pull_request,
                pr_url=pull_request_payload.get("html_url"),
            )
