"""Seer ↔ PullRequest helpers.

Resolve Seer-reported repo/PR identifiers to the canonical Sentry ``PullRequest``
(shared by PR-metrics attribution and the Seer run→PR linking, so both converge
on one row per PR), and link Seer runs to the PRs they open.
"""

from __future__ import annotations

import dataclasses
import logging
from collections.abc import Mapping, Sequence
from typing import Any

from django.db.models import Q

from sentry import options
from sentry.constants import ObjectStatus
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.seer.models.run import SeerRun, SeerRunPullRequest

logger = logging.getLogger(__name__)

# SCM providers that can legitimately back a Repository. Seer normalizes its
# provider to one of these (lowercased, no ``integrations:`` prefix); anything
# else is a value we don't understand and should be fixed upstream.
KNOWN_SCM_PROVIDERS = frozenset(
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


def normalize_provider(provider: str | None) -> str | None:
    """Normalize Seer's provider to Sentry's unprefixed form, or None if unusable.

    Returns None for the ``"unknown"`` sentinel (Seer couldn't resolve the repo)
    and for empty values — neither can scope a provider filter.
    """
    if not provider:
        return None
    provider = provider.lower()
    if provider.startswith("integrations:"):
        provider = provider.split(":", 1)[1]
    if provider == "unknown":
        return None
    return provider


def resolve_repository(
    *, organization_id: int, repo_name: str, normalized_provider: str | None
) -> tuple[Repository | None, str]:
    """Resolve the org-scoped active repo, returning ``(repo, reason)``.

    Reason is ``"resolved"``, ``"not_found"`` (zero matches), or ``"ambiguous"``
    (more than one). A known provider disambiguates same-named repos across
    providers; otherwise resolution requires exactly one match.
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

    matches = list(candidates.order_by("id")[:2])
    if len(matches) == 1:
        return matches[0], "resolved"
    return None, "ambiguous" if matches else "not_found"


@dataclasses.dataclass(frozen=True)
class SeerPullRequestResolution:
    pull_request: PullRequest | None
    repo_status: str  # "resolved" | "not_found" | "ambiguous"
    provider_recognized: bool


def get_or_create_seer_pull_request(
    *,
    organization_id: int,
    repo_name: str,
    provider: str | None,
    pr_number: int | str,
) -> SeerPullRequestResolution:
    """Resolve the repo and find-or-create the canonical PullRequest for a PR.

    Keyed on ``(organization, repository, pr_number)`` and race-safe via the unique
    constraint. May create a shell row (no title/body) ahead of the SCM ``opened``
    webhook; callers must never overwrite those fields. Returns the resolution;
    ``pull_request`` is None when the repo can't be uniquely resolved.
    """
    normalized_provider = normalize_provider(provider)
    provider_recognized = normalized_provider is None or normalized_provider in KNOWN_SCM_PROVIDERS

    repository, repo_status = resolve_repository(
        organization_id=organization_id,
        repo_name=repo_name,
        normalized_provider=normalized_provider,
    )
    if repository is None:
        return SeerPullRequestResolution(None, repo_status, provider_recognized)

    pull_request, _ = PullRequest.objects.get_or_create(
        organization_id=organization_id,
        repository_id=repository.id,
        key=str(pr_number),
    )
    return SeerPullRequestResolution(pull_request, repo_status, provider_recognized)


def maybe_link_seer_run_to_pull_requests(
    *,
    organization: Organization,
    pull_requests: Sequence[Mapping[str, Any]],
    run_id: int,
) -> None:
    """Killswitch-gated, never-throwing entry point for run→PR linking.

    Callers can fire-and-forget this; the killswitch short-circuits it and any
    failure is logged rather than propagated.
    """
    if options.get("seer.run-pr-link.killswitch.enabled"):
        return
    try:
        link_seer_run_to_pull_requests(
            organization=organization, pull_requests=pull_requests, run_id=run_id
        )
    except Exception:
        logger.exception(
            "seer.pr_link.failed",
            extra={"organization_id": organization.id, "seer_run_state_id": run_id},
        )


def link_seer_run_to_pull_requests(
    *,
    organization: Organization,
    pull_requests: Sequence[Mapping[str, Any]],
    run_id: int,
) -> None:
    """Record a ``SeerRunPullRequest`` for each PR a Seer run reported opening.

    ``pull_requests`` is the ``seer.pr_created`` payload (same shape attribution
    consumes); ``run_id`` is Seer's ``DbRunState.id``. Best-effort per entry.
    """
    seer_run = SeerRun.objects.filter(
        organization_id=organization.id, seer_run_state_id=run_id
    ).first()
    if seer_run is None:
        logger.warning(
            "seer.pr_link.run_not_found",
            extra={"organization_id": organization.id, "seer_run_state_id": run_id},
        )
        return

    for entry in pull_requests:
        repo_name = entry.get("repo_name")
        provider = entry.get("provider")
        pr_payload = entry.get("pull_request") or {}
        pr_number = pr_payload.get("pr_number")

        log_context = {
            "organization_id": organization.id,
            "seer_run_state_id": run_id,
            "repo_name": repo_name,
            "provider": provider,
            "pr_number": pr_number,
        }

        if not repo_name or pr_number is None:
            logger.warning("seer.pr_link.missing_fields", extra=log_context)
            continue

        resolution = get_or_create_seer_pull_request(
            organization_id=organization.id,
            repo_name=repo_name,
            provider=provider,
            pr_number=pr_number,
        )
        if resolution.pull_request is None:
            logger.warning("seer.pr_link.repo_unresolved", extra=log_context)
            continue

        SeerRunPullRequest.objects.get_or_create(
            seer_run=seer_run, pull_request=resolution.pull_request
        )
        logger.info(
            "seer.pr_link.recorded",
            extra={**log_context, "pull_request_id": resolution.pull_request.id},
        )
