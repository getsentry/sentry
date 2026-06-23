"""Resolve and find-or-create the canonical PullRequest for a Seer-reported PR.

Shared by PR-metrics attribution and the Seer run→PR linking so both resolve the
same repo and converge on one canonical PullRequest row per PR.
"""

from __future__ import annotations

import dataclasses

from django.db.models import Q

from sentry.constants import ObjectStatus
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository

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
