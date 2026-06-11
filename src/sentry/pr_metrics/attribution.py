"""PR attribution resolver for the PR Merge Live Metrics project.

This module owns the Sentry-side bookkeeping for *which* agent or feature a pull
request can be attributed to. A PR can have multiple attributions over its
lifetime (a Seer-authored PR may also reference a Sentry issue, etc.), so every
detected signal is preserved as its own ``PullRequestAttribution`` row rather
than collapsed into a single field.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping, Sequence
from typing import Any

from django.db.models import Q

from sentry import features
from sentry.constants import ObjectStatus
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.models.repository import Repository

logger = logging.getLogger(__name__)

# SCM providers that can legitimately back a Repository. Seer normalizes its
# provider to one of these (lowercased, no ``integrations:`` prefix); anything
# else in the event is a value we don't understand and should be fixed upstream.
_KNOWN_SCM_PROVIDERS = frozenset(
    {
        IntegrationProviderSlug.GITHUB,
        IntegrationProviderSlug.GITHUB_ENTERPRISE,
        IntegrationProviderSlug.GITLAB,
        IntegrationProviderSlug.BITBUCKET,
        IntegrationProviderSlug.BITBUCKET_SERVER,
        IntegrationProviderSlug.AZURE_DEVOPS,
        IntegrationProviderSlug.PERFORCE,
    }
)

# Precedence for picking a PR's primary attribution when more than one valid
# signal is present (highest first): direct agent-authored signals rank above
# weaker heuristics like a bare issue reference.
SIGNAL_TYPE_CONFIDENCE: dict[str, int] = {
    PullRequestAttributionSignalType.SENTRY_APP: 100,
    PullRequestAttributionSignalType.SEER_DELEGATED_CURSOR: 80,
    PullRequestAttributionSignalType.SEER_DELEGATED_GITHUB_COPILOT: 80,
    PullRequestAttributionSignalType.SEER_DELEGATED_CLAUDE_CODE: 80,
    PullRequestAttributionSignalType.SEER_DELEGATED_UNKNOWN: 70,
    PullRequestAttributionSignalType.MCP: 50,
    PullRequestAttributionSignalType.REFERENCED_ISSUE: 25,
    PullRequestAttributionSignalType.UNKNOWN: 0,
}


def record_attribution_signal(
    *,
    pull_request: PullRequest,
    signal_type: PullRequestAttributionSignalType,
    source: PullRequestAttributionSource,
    signal_details: Mapping[str, Any] | None = None,
) -> PullRequestAttribution:
    """Idempotently record one detected attribution signal for a PR.

    Keyed on ``(pull_request, signal_type, source)`` — matching the model's
    unique constraint — so webhook/event redelivery updates the existing row's
    ``signal_details`` rather than inserting a duplicate.
    """
    details = dict(signal_details) if signal_details is not None else None

    attribution, created = PullRequestAttribution.objects.get_or_create(
        pull_request=pull_request,
        signal_type=signal_type,
        source=source,
        defaults={"signal_details": details, "is_valid": True},
    )

    # Refresh details on redelivery — and revive a previously-invalidated signal,
    # since the source is reporting it as present again.
    if not created and (attribution.signal_details != details or not attribution.is_valid):
        attribution.signal_details = details
        attribution.is_valid = True
        attribution.save(update_fields=["signal_details", "is_valid", "date_updated"])

    return attribution


def recompute_pull_request_attribution(pull_request: PullRequest) -> str | None:
    """Return the highest-confidence valid attribution signal for a PR.

    Returns the winning ``signal_type``, or ``None`` when the PR has no valid
    signals.
    """
    valid_signal_types = PullRequestAttribution.objects.filter(
        pull_request=pull_request, is_valid=True
    ).values_list("signal_type", flat=True)

    return max(
        valid_signal_types,
        key=lambda signal_type: SIGNAL_TYPE_CONFIDENCE.get(signal_type, -1),
        default=None,
    )


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
    """Resolve the org-scoped ``Repository`` for a reported PR, find-or-create the
    canonical ``PullRequest`` row (keyed on PR number), and idempotently record one
    attribution signal. Shared by the Seer-native and delegated-agent paths.

    A find-or-create here may run before the SCM ``opened`` webhook arrives, so the
    ``PullRequest`` row can be a shell (no title/body); the GitHub webhook fills
    those in later. We never overwrite them from this path.

    Failures are logged and swallowed rather than raised, so a batch caller's
    remaining PRs are unaffected.
    """
    normalized_provider = _normalize_provider(provider)
    # A present-but-unrecognized provider means the source sent something we don't
    # map — warn so it can be corrected upstream, but still attempt to resolve.
    if normalized_provider is not None and normalized_provider not in _KNOWN_SCM_PROVIDERS:
        logger.warning("seer.pr_attribution.unrecognized_provider", extra=log_context)

    repository, resolution = _resolve_repository(
        organization_id=organization_id,
        repo_name=repo_name,
        normalized_provider=normalized_provider,
    )
    if repository is None:
        if resolution == "ambiguous":
            logger.warning("seer.pr_attribution.repo_ambiguous", extra=log_context)
        else:
            logger.warning("seer.pr_attribution.repo_not_found", extra=log_context)
        return

    # get_or_create is race-safe via the unique constraints — Django retries the
    # get on IntegrityError.
    try:
        pull_request, _ = PullRequest.objects.get_or_create(
            organization_id=organization_id,
            repository_id=repository.id,
            key=str(pr_number),
        )
        record_attribution_signal(
            pull_request=pull_request,
            signal_type=signal_type,
            source=source,
            signal_details=signal_details,
        )
    except Exception:
        logger.exception("seer.pr_attribution.record_failed", extra=log_context)
        return

    logger.info("seer.pr_attribution.recorded", extra=log_context)


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
            logger.warning("seer.pr_attribution.missing_fields", extra=log_context)
            continue

        _attribute_pull_request(
            organization_id=organization.id,
            repo_name=repo_name,
            provider=provider,
            pr_number=pr_number,
            signal_type=PullRequestAttributionSignalType.SENTRY_APP,
            source=PullRequestAttributionSource.SEER_DATA,
            signal_details={"run_id": run_id, "group_id": group_id, "pr_url": pr_url},
            log_context=log_context,
        )


def _resolve_repository(
    *, organization_id: int, repo_name: str, normalized_provider: str | None
) -> tuple[Repository | None, str]:
    """Resolve the org-scoped active repository for a Seer-reported PR.

    Sentry stores the ``integrations:``-prefixed provider while Seer sends the
    bare form, so we match both shapes — the same mapping
    ``filter_repo_by_provider`` uses.

    Resolves only when exactly one repo matches. A known provider disambiguates
    same-named repos across providers; an unknown provider (Seer couldn't match
    the repo) refuses to guess between them rather than risk mis-attribution.

    Returns ``(repository, reason)`` where reason is ``"resolved"``,
    ``"not_found"`` (zero matches), or ``"ambiguous"`` (more than one).
    """
    candidates = Repository.objects.filter(
        organization_id=organization_id,
        name=repo_name,
        status=ObjectStatus.ACTIVE,
    )

    if normalized_provider is not None:
        candidates = candidates.filter(
            Q(provider=normalized_provider) | Q(provider=f"integrations:{normalized_provider}")
        )

    # Fetch up to 2 to detect ambiguity — the same name can exist under
    # multiple providers (e.g. github & gitlab) within one org.
    matches = list(candidates.order_by("id")[:2])
    if len(matches) == 1:
        return matches[0], "resolved"
    return None, "ambiguous" if matches else "not_found"


def attribute_delegated_agent_pull_request(
    *,
    organization_id: int,
    signal_type: PullRequestAttributionSignalType,
    repo_full_name: str,
    repo_provider: str,
    pr_url: str,
    agent_id: str | None = None,
) -> None:
    """Attribute a PR opened by a Seer-delegated coding agent (Cursor/Copilot/Claude).

    Sentry learns of these PRs directly — by polling the agent (GitHub Copilot,
    Claude Code) or via the agent's webhook (Cursor) — rather than from Seer's
    ``seer.pr_created`` event, so attribution is recorded here at the detection
    point. Callers pass the ``SEER_DELEGATED_*`` signal type for the authoring
    agent; unlike Seer-native PRs we never attribute these to ``SENTRY_APP``.

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

    pr_number = _parse_pr_number(pr_url)

    log_context = {
        "organization_id": organization_id,
        "signal_type": signal_type,
        "agent_id": agent_id,
        "repo_name": repo_full_name,
        "pr_url": pr_url,
        "pr_number": pr_number,
    }

    if pr_number is None:
        logger.warning("seer.pr_attribution.invalid_pr_url", extra=log_context)
        return

    _attribute_pull_request(
        organization_id=organization_id,
        repo_name=repo_full_name,
        provider=repo_provider,
        pr_number=pr_number,
        signal_type=signal_type,
        source=PullRequestAttributionSource.SEER_DATA,
        signal_details={"agent_id": agent_id, "pr_url": pr_url},
        log_context=log_context,
    )


def _parse_pr_number(pr_url: str) -> int | None:
    """Extract the PR/MR number from a pull-request URL, or None if there isn't one.

    Matches the number after a ``/pull/`` (GitHub) or ``/merge_requests/`` (GitLab)
    segment specifically — a delegated agent can report a branch/``tree`` URL as its
    result, and we must not mistake a trailing branch-name segment for a PR number.
    """
    match = re.search(r"/(?:pull|pulls|merge_requests)/(\d+)", pr_url)
    return int(match.group(1)) if match else None


def _normalize_provider(provider: str | None) -> str | None:
    """Normalize Seer's provider to Sentry's unprefixed form, or None if unusable.

    Returns None for the ``"unknown"`` sentinel (Seer couldn't resolve the repo)
    and for empty values — neither can scope a provider filter. Lowercases before
    the sentinel check so any casing (e.g. ``UNKNOWN``) is treated as unknown.
    """
    if not provider:
        return None
    provider = provider.lower()
    if provider.startswith("integrations:"):
        provider = provider.split(":", 1)[1]
    if provider == "unknown":
        return None
    return provider
