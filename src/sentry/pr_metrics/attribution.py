"""PR attribution resolver for the PR Merge Live Metrics project.

This module owns the Sentry-side bookkeeping for *which* agent or feature a pull
request can be attributed to. A PR can have multiple attributions over its
lifetime (a Seer-authored PR may also reference a Sentry issue, etc.), so every
detected signal is preserved as its own ``PullRequestAttribution`` row rather
than collapsed into a single field.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from django.db import router, transaction
from pydantic import BaseModel

from sentry import features
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
    ResolvedPullRequest,
    parse_pull_request_number,
)

logger = logging.getLogger(__name__)


class SentryAppSignalDetails(BaseModel):
    """Typed signal_details for SENTRY_APP attribution signals.

    Populated by both the GitHub webhook path and the Seer pr_created event.
    Fields that are unavailable at a given source are left at their defaults.
    """

    pr_url: str
    group_ids: list[int] = []
    run_id: int | None = None


class DelegatedAgentSignalDetails(BaseModel):
    """Typed signal_details for SEER_DELEGATED_* attribution signals."""

    agent_id: str | None = None
    pr_url: str
    run_id: int | None = None
    group_ids: list[int] = []


# Signal types that use DelegatedAgentSignalDetails for their signal_details.
DELEGATED_SIGNAL_TYPES = frozenset(
    {
        PullRequestAttributionSignalType.SEER_DELEGATED_CURSOR,
        PullRequestAttributionSignalType.SEER_DELEGATED_GITHUB_COPILOT,
        PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE,
        PullRequestAttributionSignalType.SEER_DELEGATED_UNKNOWN,
    }
)

# Signal types that qualify a PR for Seer judge forwarding.
# Weaker heuristics (MCP issue views, bare issue references) do not warrant
# the expensive judge call — only direct agent authorship does.
JUDGE_ELIGIBLE_SIGNAL_TYPES = DELEGATED_SIGNAL_TYPES | frozenset(
    {PullRequestAttributionSignalType.SENTRY_APP}
)


def is_seer_attribution(attribution: PullRequestAttribution) -> bool:
    return (
        attribution.source == PullRequestAttributionSource.SEER_DATA
        or attribution.signal_type in DELEGATED_SIGNAL_TYPES
    )


def _merge_signal_details(
    existing: Mapping[str, Any] | None, incoming: Mapping[str, Any] | None
) -> dict[str, Any] | None:
    """Combine two ``signal_details`` payloads for the same attribution row.

    Schema-agnostic, since ``signal_details`` shapes differ by signal type: list
    values are unioned (e.g. ``group_ids``), dict values are merged with the
    incoming side winning on key conflicts (e.g. MCP's group_id -> client_family
    map), and every other value keeps the incoming value when truthy, else falls
    back to the existing one.
    """
    if existing is None:
        return dict(incoming) if incoming is not None else None
    if incoming is None:
        return dict(existing)

    merged = dict(existing)
    for key, new_value in incoming.items():
        old_value = merged.get(key)
        if isinstance(old_value, list) and isinstance(new_value, list):
            merged[key] = sorted({*old_value, *new_value})
        elif isinstance(old_value, Mapping) and isinstance(new_value, Mapping):
            merged[key] = {**old_value, **new_value}
        elif new_value:
            merged[key] = new_value
    return merged


def record_attribution_signal(
    *,
    pull_request: PullRequest,
    signal_type: PullRequestAttributionSignalType,
    source: PullRequestAttributionSource,
    signal_details: Mapping[str, Any] | None = None,
) -> PullRequestAttribution:
    """Idempotently record one detected attribution signal for a PR.

    Keyed on ``(pull_request, signal_type, source)`` — matching the model's
    unique constraint. A still-valid existing row is merged with the incoming
    details via ``_merge_signal_details`` rather than replaced outright, so two
    independent producers of the same signal/source (e.g. Seer's
    ``pr_created`` callback and the live-RPC autofix lookup) accumulate onto the
    same row instead of clobbering each other on redelivery/race. Reading the
    existing row with ``select_for_update`` inside the transaction is what
    makes that merge race-safe: it blocks a concurrent writer until this one
    commits, so the concurrent writer's merge starts from an up-to-date
    snapshot instead of a stale one it would otherwise clobber. A previously
    invalidated row is replaced outright and revived, since the source is
    reporting it as present again.
    """
    details = dict(signal_details) if signal_details is not None else None

    with transaction.atomic(using=router.db_for_write(PullRequestAttribution)):
        attribution, created = PullRequestAttribution.objects.select_for_update().get_or_create(
            pull_request=pull_request,
            signal_type=signal_type,
            source=source,
            defaults={"signal_details": details, "is_valid": True},
        )

        if created:
            return attribution

        new_details = (
            details
            if not attribution.is_valid
            else _merge_signal_details(attribution.signal_details, details)
        )
        if new_details != attribution.signal_details or not attribution.is_valid:
            attribution.signal_details = new_details
            attribution.is_valid = True
            attribution.save(update_fields=["signal_details", "is_valid", "date_updated"])

        return attribution


def _log_unresolved_reported_pull_request(
    resolved: ResolvedPullRequest, log_context: Mapping[str, Any]
) -> None:
    """Emit the attribution warnings for a reported PR that didn't resolve to a unique repo."""
    # A present-but-unrecognized provider means the source sent something we don't map —
    # warn so it can be corrected upstream.
    if resolved.provider_unmappable:
        logger.warning("pr_metrics.attribution.unrecognized_provider", extra=log_context)

    if resolved.pull_request is None:
        if resolved.repo_resolution == "ambiguous":
            logger.warning("pr_metrics.attribution.repo_ambiguous", extra=log_context)
        else:
            logger.warning("pr_metrics.attribution.repo_not_found", extra=log_context)


def _attribute_pull_request(
    *,
    organization_id: int,
    repo_name: str,
    provider: str | None,
    pr_number: int | str,
    signal_type: PullRequestAttributionSignalType,
    source: PullRequestAttributionSource,
    signal_details: Mapping[str, Any] | None,
    log_context: Mapping[str, Any],
) -> None:
    """Resolve a single reported PR to its canonical ``PullRequest`` and idempotently
    record one attribution signal. Shared by the Seer-native and delegated-agent paths.

    Resolution (repo lookup + find-or-create) lives on ``PullRequest.objects`` so every
    PR-reporting path converges on the same row; here we add only the attribution write.
    Failures are logged and swallowed rather than raised, so a batch caller's remaining
    PRs are unaffected.
    """
    try:
        resolved = PullRequest.objects.get_or_create_from_reference(
            organization_id=organization_id,
            repo_name=repo_name,
            provider=provider,
            key=pr_number,
        )
    except Exception:
        logger.exception("pr_metrics.attribution.record_failed", extra=log_context)
        return

    _log_unresolved_reported_pull_request(resolved, log_context)
    if resolved.pull_request is None:
        return

    # The repo is resolved now, so its id sharpens every log from here on.
    log_context = {**log_context, "repository_id": resolved.pull_request.repository_id}

    try:
        record_attribution_signal(
            pull_request=resolved.pull_request,
            signal_type=signal_type,
            source=source,
            signal_details=signal_details,
        )
    except Exception:
        logger.exception("pr_metrics.attribution.record_failed", extra=log_context)
        return

    logger.info(
        "pr_metrics.attribution.recorded",
        extra={**log_context, "pull_request_id": resolved.pull_request.id},
    )


def attribute_seer_created_pull_requests(
    *,
    organization: Organization,
    pull_requests: Sequence[Mapping[str, Any]],
    run_id: int | str | None,
    group_id: int | str | None,
) -> None:
    """Attribute PRs reported by Seer's ``seer.pr_created`` event to the Seer app.

    For each reported PR, record a ``sentry_app`` attribution signal. SENTRY_APP
    covers both of our GitHub apps: Seer chooses between the Sentry and Seer apps
    at push time (its write client falls back to the Seer app only when the Sentry
    app lacks write access), but we don't distinguish them — both are
    internal-agent authorship.
    """
    for entry in pull_requests:
        repo_name = entry.get("repo_name")
        provider = entry.get("provider")
        pr_payload = entry.get("pull_request") or {}
        pr_number = pr_payload.get("pr_number")
        pr_url = pr_payload.get("pr_url")

        log_context = {
            "organization_id": organization.id,
            "run_id": run_id,
            "group_id": group_id,
            "repo_name": repo_name,
            "provider": provider,
            "pr_number": pr_number,
        }

        if not repo_name or pr_number is None:
            logger.warning("pr_metrics.attribution.missing_fields", extra=log_context)
            continue

        _attribute_pull_request(
            organization_id=organization.id,
            repo_name=repo_name,
            provider=provider,
            pr_number=pr_number,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
            signal_details=SentryAppSignalDetails(
                pr_url=pr_url or "",
                group_ids=[int(group_id)] if group_id is not None else [],
                run_id=int(run_id) if run_id is not None else None,
            ).dict(),
            log_context=log_context,
        )


def attribute_delegated_agent_pull_request(
    *,
    organization_id: int,
    signal_type: PullRequestAttributionSignalType,
    repo_full_name: str,
    repo_provider: str,
    pr_url: str,
    agent_id: str | None = None,
    run_id: int | None = None,
    group_ids: Sequence[int] | None = None,
) -> None:
    """Attribute a PR opened by a Seer-delegated coding agent (Cursor/Copilot/Claude).

    Sentry learns of these PRs directly — by polling the agent (GitHub Copilot,
    Claude Code) or via the agent's webhook (Cursor) — rather than from Seer's
    ``seer.pr_created`` event, so attribution is recorded here at the detection
    point. Callers pass the ``SEER_DELEGATED_*`` signal type for the authoring
    agent; unlike Seer-native PRs we never attribute these to ``SENTRY_APP``.

    ``run_id``/``group_ids`` are optional and left sparse (``None``/``[]``) when
    a caller can't resolve them locally; ``group_ids`` is the issue(s) the
    delegated run was launched against, mirroring the field already on
    ``SentryAppSignalDetails``.

    Gated behind ``organizations:pr-metrics-attribution``. Best-effort: callers run
    this inside the polling/webhook flow, so any failure is logged and swallowed
    rather than allowed to interrupt that flow.
    """
    try:
        organization = Organization.objects.get(id=organization_id, status=ObjectStatus.ACTIVE)
    except Organization.DoesNotExist:
        return

    if not features.has("organizations:pr-metrics-attribution", organization):
        return

    pr_number = parse_pull_request_number(pr_url)

    log_context = {
        "organization_id": organization_id,
        "signal_type": signal_type,
        "agent_id": agent_id,
        "repo_name": repo_full_name,
        "provider": repo_provider,
        "pr_url": pr_url,
        "pr_number": pr_number,
    }

    if pr_number is None:
        logger.warning("pr_metrics.attribution.invalid_pr_url", extra=log_context)
        return

    _attribute_pull_request(
        organization_id=organization_id,
        repo_name=repo_full_name,
        provider=repo_provider,
        pr_number=pr_number,
        signal_type=signal_type,
        source=PullRequestAttributionSource.SEER_DATA,
        signal_details=DelegatedAgentSignalDetails(
            agent_id=agent_id,
            pr_url=pr_url,
            run_id=run_id,
            group_ids=list(group_ids) if group_ids else [],
        ).dict(),
        log_context=log_context,
    )
