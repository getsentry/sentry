"""Resolution of Seer-reported pull requests to their canonical ``PullRequest`` rows.

Seer's ``seer.pr_created`` event reports the PRs a run opened as
``(repo_name, provider, pr_number)`` references. This module turns those references into
canonical ``PullRequest`` rows via the shared model-layer resolver
(``PullRequest.objects.get_or_create_from_reference``), so the operator can resolve a
payload once and fan the result out to both run→PR linking and PR-metrics attribution
without re-querying.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any, NamedTuple

from sentry.models.pullrequest import PullRequest, ResolvedPullRequest

logger = logging.getLogger(__name__)


class SeerCreatedPullRequest(NamedTuple):
    """A pull request reported by ``seer.pr_created``, resolved to its canonical row."""

    pull_request: PullRequest
    pr_url: str | None


def resolve_seer_created_pull_requests(
    *,
    organization_id: int,
    pull_requests: Sequence[Mapping[str, Any]],
    log_context: Mapping[str, Any],
) -> list[SeerCreatedPullRequest]:
    """Resolve each ``seer.pr_created`` entry to its canonical ``PullRequest``.

    Returns a ``SeerCreatedPullRequest`` for every entry that resolves, skipping and
    logging the rest. Resolution is shared by run→PR linking and PR-metrics attribution,
    so a caller resolves once and fans the result out to both rather than re-querying.

    The repo lookup + find-or-create lives on ``PullRequest.objects`` so every PR-reporting
    path converges on the same row; we own the logging here.
    """
    resolved_prs: list[SeerCreatedPullRequest] = []
    for entry in pull_requests:
        repo_name = entry.get("repo_name")
        provider = entry.get("provider")
        pr_payload = entry.get("pull_request") or {}
        pr_number = pr_payload.get("pr_number")
        entry_context = {
            **log_context,
            "repo_name": repo_name,
            "provider": provider,
            "pr_number": pr_number,
        }

        if not repo_name or pr_number is None:
            logger.warning("seer.pr_resolution.missing_fields", extra=entry_context)
            continue

        try:
            resolved = PullRequest.objects.get_or_create_from_reference(
                organization_id=organization_id,
                repo_name=repo_name,
                provider=provider,
                key=pr_number,
            )
        except Exception:
            logger.exception("seer.pr_resolution.failed", extra=entry_context)
            continue

        _log_unresolved(resolved, entry_context)
        if resolved.pull_request is not None:
            resolved_prs.append(
                SeerCreatedPullRequest(resolved.pull_request, pr_payload.get("pr_url"))
            )

    return resolved_prs


def _log_unresolved(resolved: ResolvedPullRequest, log_context: Mapping[str, Any]) -> None:
    """Warn when a reported PR didn't resolve to a unique repository."""
    # A present-but-unrecognized provider means Seer sent something we don't map —
    # warn so it can be corrected upstream.
    if resolved.provider_unmappable:
        logger.warning("seer.pr_resolution.unrecognized_provider", extra=log_context)

    if resolved.pull_request is None:
        if resolved.repo_resolution == "ambiguous":
            logger.warning("seer.pr_resolution.repo_ambiguous", extra=log_context)
        else:
            logger.warning("seer.pr_resolution.repo_not_found", extra=log_context)
